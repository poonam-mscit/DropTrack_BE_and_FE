import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import nodemailer, { type Transporter } from 'nodemailer';

const OUTBOX_DIR = process.env.EMAIL_OUTBOX_DIR ?? '/tmp/droptrack-outbox';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private stubbed: boolean;
  private readonly fromAddress: string;

  constructor() {
    this.fromAddress = process.env.SES_FROM_EMAIL ?? 'welcome@droptrack.au';

    /**
     * Real SES is opt-in: we require an explicit `AWS_SES_REGION` (not the
     * generic AWS_REGION) so a partly-configured local box defaults to STUB
     * instead of crashing at boot.
     */
    const region = process.env.AWS_SES_REGION;
    if (!region) {
      this.stubbed = true;
      this.logger.warn(
        'AWS_SES_REGION not set — email runs in STUB mode (writes to /tmp/droptrack-outbox).',
      );
      if (!existsSync(OUTBOX_DIR)) mkdirSync(OUTBOX_DIR, { recursive: true });
    } else {
      try {
        const ses = new SESv2Client({ region });
        this.transporter = nodemailer.createTransport({
          SES: { sesClient: ses, SendEmailCommand },
        });
        this.stubbed = false;
        this.logger.log(`SES email enabled · region=${region} · from=${this.fromAddress}`);
      } catch (err) {
        this.stubbed = true;
        this.logger.warn(
          `SES init failed (${(err as Error).message}) — falling back to STUB mode.`,
        );
        if (!existsSync(OUTBOX_DIR)) mkdirSync(OUTBOX_DIR, { recursive: true });
      }
    }
  }

  /**
   * Send the AI Campaign Report as an email with the PDF attached.
   * In STUB mode, writes the email metadata + a copy of the PDF to /tmp/droptrack-outbox.
   */
  async sendCampaignReport(params: {
    to: string;
    clientName: string;
    jobCode: string;
    jobTitle: string;
    narrative: string;
    pdfPath: string;
    pdfFilename: string;
  }) {
    const { to, clientName, jobCode, jobTitle, narrative, pdfPath, pdfFilename } = params;

    const subject = `Your DropTrack campaign report — ${jobTitle}`;
    const text = renderText({ clientName, jobCode, jobTitle, narrative });
    const html = renderHtml({ clientName, jobCode, jobTitle, narrative });

    if (this.stubbed || !this.transporter) {
      // Write a record to the outbox folder for inspection.
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const meta = {
        sentAt: new Date().toISOString(),
        from: this.fromAddress,
        to,
        subject,
        pdfAttachment: pdfFilename,
      };
      writeFileSync(join(OUTBOX_DIR, `${stamp}-${jobCode}.json`), JSON.stringify(meta, null, 2));
      writeFileSync(join(OUTBOX_DIR, `${stamp}-${jobCode}.txt`), text);
      this.logger.log(`STUB email written to ${OUTBOX_DIR} (subject: ${subject})`);
      return { stubbed: true, messageId: `stub-${stamp}` };
    }

    const info = await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject,
      text,
      html,
      attachments: [{ filename: pdfFilename, path: pdfPath, contentType: 'application/pdf' }],
    });
    this.logger.log(`SES email sent: ${info.messageId}`);
    return { stubbed: false, messageId: info.messageId };
  }

  /**
   * Send a dropper invite with the accept-URL button. Called from the
   * admin dropper-invites endpoint once the row is written.
   */
  async sendDropperInvite(params: {
    to: string;
    firstName: string;
    acceptUrl: string;
    deepLink: string;
    expiresAt: Date;
  }) {
    const { to, firstName, acceptUrl, deepLink, expiresAt } = params;
    const subject = `You're invited to join DropTrack as a Dropper`;
    const text = renderInviteText({ firstName, acceptUrl, deepLink, expiresAt });
    const html = renderInviteHtml({ firstName, acceptUrl, deepLink, expiresAt });

    if (this.stubbed || !this.transporter) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      writeFileSync(
        join(OUTBOX_DIR, `${stamp}-invite-${to.replace(/[^a-z0-9]/gi, '_')}.json`),
        JSON.stringify({ sentAt: new Date().toISOString(), from: this.fromAddress, to, subject, acceptUrl }, null, 2),
      );
      writeFileSync(join(OUTBOX_DIR, `${stamp}-invite-${to.replace(/[^a-z0-9]/gi, '_')}.html`), html);
      this.logger.log(`STUB invite written to ${OUTBOX_DIR} (to: ${to})`);
      return { stubbed: true, messageId: `stub-${stamp}` };
    }

    const info = await this.transporter.sendMail({ from: this.fromAddress, to, subject, text, html });
    this.logger.log(`Invite email sent to ${to}: ${info.messageId}`);
    return { stubbed: false, messageId: info.messageId };
  }
}

function renderText({
  clientName,
  jobCode,
  jobTitle,
  narrative,
}: {
  clientName: string;
  jobCode: string;
  jobTitle: string;
  narrative: string;
}) {
  return `Hi ${clientName},

Your DropTrack campaign "${jobTitle}" (${jobCode}) is complete. The full AI-generated report is attached as a PDF.

A short summary:

${narrative}

Reply to this email if anything looks off and a human will get back to you.

— The DropTrack team
Sydney, Australia · droptrack.au
`;
}

function renderHtml({
  clientName,
  jobCode,
  jobTitle,
  narrative,
}: {
  clientName: string;
  jobCode: string;
  jobTitle: string;
  narrative: string;
}) {
  const paras = narrative
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55;color:#4B5161;">${escapeHtml(p)}</p>`)
    .join('');
  return `<!doctype html>
<html><body style="background:#F8F9FB;margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EDEEF1;">
    <tr>
      <td style="background:#1A1B36;padding:22px 28px;color:#fff;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.14em;color:#A3E635;text-transform:uppercase;">DropTrack</div>
        <div style="font-size:18px;font-weight:700;margin-top:6px;">AI Campaign Report</div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px;">
        <h1 style="margin:0 0 6px;font-size:22px;letter-spacing:-0.02em;">${escapeHtml(jobTitle)}</h1>
        <div style="font-size:13px;color:#8B92A4;margin-bottom:22px;">${escapeHtml(jobCode)}</div>

        <p style="margin:0 0 18px;color:#0B0D12;">Hi ${escapeHtml(clientName)},</p>
        <p style="margin:0 0 18px;color:#0B0D12;">Your campaign is complete — here&rsquo;s the short version. The full breakdown is attached as a PDF.</p>

        ${paras}

        <div style="margin-top:24px;padding:14px 16px;background:#EEF2FF;border-radius:12px;font-size:13px;color:#3730A3;">
          PDF report attached &middot; verified GPS audit included
        </div>

        <p style="margin:24px 0 0;font-size:13px;color:#8B92A4;">— The DropTrack team<br>Sydney, Australia &middot; droptrack.au</p>
      </td>
    </tr>
  </table>
</body></html>`;
}

function renderInviteText({
  firstName,
  acceptUrl,
  deepLink,
  expiresAt,
}: {
  firstName: string;
  acceptUrl: string;
  deepLink: string;
  expiresAt: Date;
}) {
  const dateStr = expiresAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  return `Hi ${firstName},

You've been invited to join DropTrack as a Dropper — the AU-based, GPS-verified leaflet distribution platform.

Accept your invite and set your password:
${acceptUrl}

On your phone with the DropTrack app installed:
${deepLink}

This link expires on ${dateStr}. If you didn't expect this invite, ignore this email.

— The DropTrack team
Drop Track Pty Ltd · ABN 39 697 128 920
hello@droptrack.com.au
`;
}

function renderInviteHtml({
  firstName,
  acceptUrl,
  deepLink,
  expiresAt,
}: {
  firstName: string;
  acceptUrl: string;
  deepLink: string;
  expiresAt: Date;
}) {
  const dateStr = expiresAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<!doctype html>
<html><body style="background:#F4F5FB;margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F1029;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E4E7F2;">
    <tr>
      <td style="background:#0F1029;padding:22px 28px;color:#fff;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.14em;color:#A3E635;text-transform:uppercase;">DropTrack</div>
        <div style="font-size:18px;font-weight:700;margin-top:6px;">You're invited</div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px;line-height:1.55;">
        <p style="margin:0 0 14px;">Hi ${escapeHtml(firstName)},</p>
        <p style="margin:0 0 14px;color:#4A4E6B;">
          You've been invited to join <strong>DropTrack</strong> as a Dropper &mdash; our AU-based, GPS-verified leaflet distribution platform. Tap the button below to accept and set your password.
        </p>

        <div style="text-align:center;margin:26px 0;">
          <a href="${acceptUrl}" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;">
            Accept invite &amp; set password
          </a>
        </div>

        <p style="margin:0 0 8px;color:#4A4E6B;font-size:13px;">Or copy this link into your browser:</p>
        <p style="margin:0 0 20px;font-size:12px;word-break:break-all;">
          <a href="${acceptUrl}" style="color:#4F46E5;text-decoration:none;">${escapeHtml(acceptUrl)}</a>
        </p>

        <div style="background:#F4F5FB;border:1px solid #E4E7F2;border-radius:12px;padding:14px 16px;margin:0 0 20px;font-size:13px;color:#4A4E6B;">
          Already have the DropTrack Dropper app? Open on your phone:
          <a href="${deepLink}" style="color:#4F46E5;text-decoration:none;">${escapeHtml(deepLink)}</a>
        </div>

        <p style="margin:0;color:#8A8FA8;font-size:13px;">
          This invite expires on <strong>${dateStr}</strong>. If you didn't expect this email, you can safely ignore it.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px;background:#FAFBFF;border-top:1px solid #E4E7F2;color:#8A8FA8;font-size:12px;">
        Drop Track Pty Ltd &middot; ABN 39 697 128 920 &middot; 42/21 Braybrooke Street, Bruce ACT 2617<br />
        Questions? <a href="mailto:hello@droptrack.com.au" style="color:#4F46E5;text-decoration:none;">hello@droptrack.com.au</a>
      </td>
    </tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
