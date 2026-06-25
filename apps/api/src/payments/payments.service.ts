import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import Stripe from 'stripe';
import type { Database } from '@droptrack/db';
import { businessProfiles, jobs, payments, users } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { STRIPE } from './stripe.provider.js';
import { priceForLeaflets, DEFAULT_PRICING_CONFIG, type PricingConfig } from './pricing.js';
import { SETTING_KEYS, SettingsService } from '../settings/settings.service.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(STRIPE) private readonly stripe: Stripe,
    private readonly settings: SettingsService,
  ) {}

  /** Resolve admin-tunable pricing config (cached 30s). */
  private async livePricingConfig(): Promise<PricingConfig> {
    const [base, fee, gst] = await Promise.all([
      this.settings.get<number>(SETTING_KEYS.pricingBasePerLeafletCents, DEFAULT_PRICING_CONFIG.basePerLeafletCents),
      this.settings.get<number>(SETTING_KEYS.pricingPlatformFeePct, DEFAULT_PRICING_CONFIG.platformFeePct),
      this.settings.get<number>(SETTING_KEYS.pricingGstPct, DEFAULT_PRICING_CONFIG.gstPct),
    ]);
    return { basePerLeafletCents: base, platformFeePct: fee, gstPct: gst };
  }

  /**
   * Create (or reuse) a Stripe Checkout Session for a job.
   * - Idempotent: a job that already has a `pending` or `succeeded` payment
   *   reuses its session rather than spawning duplicates.
   * - Creates a Stripe Customer on demand for the business and stores the id.
   */
  async createCheckoutSession(jobId: string) {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    if (job.status !== 'draft' && job.status !== 'paid_unassigned') {
      throw new ConflictException(`Job is in status "${job.status}" — cannot checkout`);
    }

    // Reuse a pending session if one exists.
    const [existing] = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.jobId, jobId), eq(payments.status, 'pending')))
      .limit(1);
    if (existing?.stripeCheckoutSessionId) {
      const session = await this.stripe.checkout.sessions.retrieve(existing.stripeCheckoutSessionId);
      if (session.status === 'open' && session.url) {
        return { url: session.url, sessionId: session.id, reused: true };
      }
    }

    // Get the client & their Stripe customer id (create if missing).
    const [client] = await this.db.select().from(users).where(eq(users.id, job.clientUserId)).limit(1);
    if (!client) throw new BadRequestException('Job is missing a client');

    // Get or auto-create the client's business profile. New self-serve signups
    // don't have one yet — we create a minimal placeholder so checkout doesn't
    // block, and the agent can complete it later from /profile.
    let profile = (
      await this.db
        .select()
        .from(businessProfiles)
        .where(eq(businessProfiles.userId, client.id))
        .limit(1)
    )[0];
    if (!profile) {
      this.logger.log(
        `Bootstrapping placeholder business profile for new client ${client.email}`,
      );
      // Derive a friendly name from email: "sarah@belleproperty.com.au" → "Belle Property"
      const inferredName = inferBusinessName(client.email);
      const inferredIndustry = inferIndustryFromJob(job.campaignType);
      [profile] = await this.db
        .insert(businessProfiles)
        .values({
          userId: client.id,
          businessName: inferredName,
          industry: inferredIndustry,
          gstRegistered: false,
        })
        .returning();
    }

    let customerId = profile.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: client.email,
        name: profile.businessName,
        metadata: {
          dt_user_id: client.id,
          dt_business_name: profile.businessName,
        },
      });
      customerId = customer.id;
      await this.db
        .update(businessProfiles)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(businessProfiles.userId, client.id));
    }

    const price = priceForLeaflets(job.leafletCount, await this.livePricingConfig());
    // Where Stripe sends the user after success / cancel.
    //   STRIPE_SUCCESS_URL / STRIPE_CANCEL_URL override directly.
    //   Otherwise WEB_BASE_URL is used as the host and we append our standard paths.
    //   Final fallback for dev is the local agent app on :3002.
    const webBase = process.env.WEB_BASE_URL ?? 'http://localhost:3002';
    const successUrl =
      process.env.STRIPE_SUCCESS_URL ?? `${webBase}/campaigns?paid=1&job=${jobId}`;
    const cancelUrl =
      process.env.STRIPE_CANCEL_URL ?? `${webBase}/create/pay?cancelled=1`;

    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer: customerId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'aud',
              unit_amount: price.totalCents, // GST-inclusive
              tax_behavior: 'inclusive',
              product_data: {
                name: job.title,
                description: `${job.leafletCount.toLocaleString()} leaflets · ${job.jobCode}`,
              },
            },
          },
        ],
        client_reference_id: job.id,
        metadata: {
          dt_job_id: job.id,
          dt_job_code: job.jobCode,
          dt_client_user_id: client.id,
        },
        success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 h
      },
      { idempotencyKey: `job-${job.id}-${Date.now()}` },
    );

    // Persist as a `pending` payment row.
    await this.db
      .insert(payments)
      .values({
        jobId: job.id,
        clientUserId: client.id,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: session.payment_intent as string | null,
        amountNetCents: price.netCents,
        gstCents: price.gstCents,
        platformFeeCents: price.platformFeeCents,
        amountTotalCents: price.totalCents,
        status: 'pending',
      });

    this.logger.log(`Checkout session ${session.id} created for job ${job.jobCode}`);
    if (!session.url) throw new BadRequestException('Stripe did not return a URL');
    return { url: session.url, sessionId: session.id, reused: false };
  }

  /**
   * Apply a Stripe webhook event to our DB.
   * Returns true if we should ack with 200, false otherwise (idempotent retries).
   */
  async handleWebhookEvent(event: Stripe.Event) {
    this.logger.log(`Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const jobId = session.client_reference_id ?? (session.metadata?.dt_job_id as string | undefined);
        if (!jobId) {
          this.logger.warn('checkout.session.completed without dt_job_id — ignoring');
          return false;
        }
        // Fetch card details + Stripe-hosted receipt URL from the underlying
        // payment intent's latest charge. receipt_url is what we surface to the
        // agent as a "View invoice" link — no PDF generation on our side.
        let cardBrand: string | null = null;
        let cardLast4: string | null = null;
        let receiptUrl: string | null = null;
        if (typeof session.payment_intent === 'string') {
          const pi = await this.stripe.paymentIntents.retrieve(session.payment_intent, {
            expand: ['payment_method', 'latest_charge'],
          });
          const pm = pi.payment_method;
          if (pm && typeof pm !== 'string' && pm.card) {
            cardBrand = pm.card.brand ?? null;
            cardLast4 = pm.card.last4 ?? null;
          }
          const charge = pi.latest_charge;
          if (charge && typeof charge !== 'string') {
            receiptUrl = charge.receipt_url ?? null;
          }
        }
        await this.db
          .update(payments)
          .set({
            status: 'succeeded',
            stripePaymentIntentId: (session.payment_intent as string) ?? null,
            cardBrand,
            cardLast4,
            receiptUrl,
            updatedAt: new Date(),
          })
          .where(eq(payments.stripeCheckoutSessionId, session.id));
        await this.db
          .update(jobs)
          .set({ status: 'paid_unassigned', paidAt: new Date() })
          .where(eq(jobs.id, jobId));
        return true;
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.db
          .update(payments)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(payments.stripeCheckoutSessionId, session.id));
        return true;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (!charge.payment_intent) return false;
        await this.db
          .update(payments)
          .set({
            status: charge.amount_refunded === charge.amount ? 'refunded' : 'partial_refund',
            refundAmountCents: charge.amount_refunded,
            refundedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(payments.stripePaymentIntentId, charge.payment_intent as string));
        return true;
      }
      default:
        return true; // ack-and-ignore — many events we don't care about
    }
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not set');
    if (!signature) throw new BadRequestException('Missing stripe-signature header');
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  /**
   * Create a Stripe Customer Portal session for the signed-in user. Returns
   * `{ url }` for client-side redirect. Stripe handles card management,
   * billing history, receipts, etc. — all PCI on their side.
   *
   * If the user has no Stripe customer yet (never paid), we throw 400 — the
   * UI should hide the portal button in that case.
   */
  async createCustomerPortalSession(userId: string): Promise<{ url: string }> {
    const [profile] = await this.db
      .select({ stripeCustomerId: businessProfiles.stripeCustomerId })
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId))
      .limit(1);
    if (!profile?.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer yet — pay for a campaign first.');
    }
    const webBase = process.env.WEB_BASE_URL ?? 'http://localhost:3002';
    const session = await this.stripe.billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: `${webBase}/billing`,
    });
    return { url: session.url };
  }
}

/**
 * Best-effort business-name from an email so a brand-new agent's Stripe receipt
 * looks human, not "user_a8c2@…". E.g. "sarah@belleproperty.com.au" → "Belle Property".
 * Falls back to the local part if the domain looks generic (gmail, etc.).
 */
function inferBusinessName(email: string): string {
  const generic = new Set(['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'me', 'live']);
  const [local, domain = ''] = email.split('@');
  const root = domain.split('.')[0] ?? '';
  if (!root || generic.has(root.toLowerCase())) {
    return capitalise(local.split(/[._-]/)[0] ?? 'New') + " — Pending";
  }
  // belleproperty → "Belle Property"; raywhite → "Ray White"; mosmandental → "Mosman Dental"
  return root
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/(?=[A-Z])|[\s_-]/)
    .filter(Boolean)
    .map(capitalise)
    .join(' ')
    .replace(/\b(realestate|property|properties)\b/i, (w) => capitalise(w));
}

type Industry =
  | 'real_estate'
  | 'medical'
  | 'political'
  | 'food'
  | 'retail'
  | 'education'
  | 'government'
  | 'other';

/** Map the campaign type to the matching industry enum value (1:1 today). */
function inferIndustryFromJob(campaignType: string | null | undefined): Industry {
  const allowed: Industry[] = [
    'real_estate',
    'medical',
    'political',
    'food',
    'retail',
    'education',
    'government',
    'other',
  ];
  return (allowed.includes(campaignType as Industry) ? campaignType : 'other') as Industry;
}

function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
}
