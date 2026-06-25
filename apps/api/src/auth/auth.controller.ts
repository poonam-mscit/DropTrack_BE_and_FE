/**
 * Auth controller — public Cognito endpoints used by the web login page.
 *
 * All endpoints here are @Public — they don't require a Bearer token.
 * On successful login we also JIT-provision the local `users` row by matching
 * email between the Cognito IdToken payload and our DB.
 */
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe, createZodDto } from 'nestjs-zod';
import { eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import type { Database } from '@droptrack/db';
import { users } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { Public } from './auth.decorators.js';
import { CognitoAuthService, type CognitoTokens } from './cognito-auth.service.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
class LoginDto extends createZodDto(LoginSchema) {}

const SignupSchema = z.object({
  firstName: z.string().min(1).max(40),
  lastName: z.string().min(1).max(40),
  email: z.string().email(),
  password: z.string().min(10),
  mobile: z
    .string()
    .regex(/^\+?[0-9 ]{8,20}$/, 'Mobile must be digits, optionally +-prefixed')
    .optional()
    .or(z.literal('')),
  acceptedTerms: z.literal(true, { message: 'You must accept the terms to continue.' }),
});
class SignupDto extends createZodDto(SignupSchema) {}

const NewPasswordSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(8),
  session: z.string().min(1),
});
class NewPasswordDto extends createZodDto(NewPasswordSchema) {}

const RefreshSchema = z.object({
  email: z.string().email(),
  refreshToken: z.string().min(1),
});
class RefreshDto extends createZodDto(RefreshSchema) {}

const ForgotSchema = z.object({ email: z.string().email() });
class ForgotDto extends createZodDto(ForgotSchema) {}

const ConfirmForgotSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  newPassword: z.string().min(8),
});
class ConfirmForgotDto extends createZodDto(ConfirmForgotSchema) {}

const RequestCodeSchema = z.object({ email: z.string().email() });
class RequestCodeDto extends createZodDto(RequestCodeSchema) {}

const ConfirmSignupSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  password: z.string().min(1),
});
class ConfirmSignupDto extends createZodDto(ConfirmSignupSchema) {}

const ResendSignupSchema = z.object({ email: z.string().email() });
class ResendSignupDto extends createZodDto(ResendSignupSchema) {}

const VerifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  session: z.string().min(1),
});
class VerifyCodeDto extends createZodDto(VerifyCodeSchema) {}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly cognito: CognitoAuthService,
    @Inject(DB) private readonly db: Database,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(LoginSchema)) body: LoginDto) {
    const tokens = await this.cognito.login(body.email, body.password);
    const profile = await this.attachProfile(body.email, tokens);
    return { ...tokens, ...profile };
  }

  @Public()
  @Post('signup')
  @HttpCode(201)
  async signup(@Body(new ZodValidationPipe(SignupSchema)) body: SignupDto) {
    // Normalise AU mobile: 04xx xxx xxx → +614xx xxx xxx for Cognito's E.164 expectation
    let phoneNumber: string | undefined;
    if (body.mobile && body.mobile.trim()) {
      const digits = body.mobile.replace(/\D/g, '');
      if (digits.startsWith('04') && digits.length === 10) {
        phoneNumber = `+61${digits.slice(1)}`;
      } else if (digits.startsWith('614') && digits.length === 11) {
        phoneNumber = `+${digits}`;
      } else if (body.mobile.startsWith('+')) {
        phoneNumber = body.mobile.replace(/\s/g, '');
      }
    }

    const delivery = await this.cognito.signup({
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      phoneNumber,
    });

    return {
      requiresVerification: true,
      email: body.email,
      deliveryDestination: delivery.deliveryDestination,
      deliveryMedium: delivery.deliveryMedium,
      message: `We emailed a verification code to ${delivery.deliveryDestination ?? body.email}. Enter it on the next screen.`,
    };
  }

  /** Step 2 of signup — confirm via the emailed code, then auto-log-in. */
  @Public()
  @Post('confirm-signup')
  @HttpCode(200)
  async confirmSignup(
    @Body(new ZodValidationPipe(ConfirmSignupSchema)) body: ConfirmSignupDto,
  ) {
    await this.cognito.confirmSignup({ email: body.email, code: body.code });

    // Auto-login so the user lands inside the app.
    const tokens = await this.cognito.login(body.email, body.password);

    // Mirror into the DropTrack DB if not already there (idempotent).
    const sub = decodeJwtSubject(tokens.idToken);
    const [existing] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);
    if (!existing && sub) {
      await this.db.insert(users).values({
        email: body.email,
        role: 'client',
        status: 'active',
        cognitoSub: sub,
      });
    }

    const profile = await this.attachProfile(body.email, tokens);
    return { ...tokens, ...profile };
  }

  /** Resend the signup verification code if the user lost the first email. */
  @Public()
  @Post('resend-signup-code')
  @HttpCode(200)
  async resendSignupCode(
    @Body(new ZodValidationPipe(ResendSignupSchema)) body: ResendSignupDto,
  ) {
    return this.cognito.resendSignupCode(body.email);
  }

  @Public()
  @Post('new-password')
  @HttpCode(200)
  async newPassword(@Body(new ZodValidationPipe(NewPasswordSchema)) body: NewPasswordDto) {
    const tokens = await this.cognito.setNewPassword(body.email, body.newPassword, body.session);
    const profile = await this.attachProfile(body.email, tokens);
    return { ...tokens, ...profile };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body(new ZodValidationPipe(RefreshSchema)) body: RefreshDto) {
    return this.cognito.refresh(body.refreshToken, body.email);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  forgot(@Body(new ZodValidationPipe(ForgotSchema)) body: ForgotDto) {
    return this.cognito.forgotPassword(body.email);
  }

  @Public()
  @Post('confirm-forgot-password')
  @HttpCode(200)
  confirmForgot(@Body(new ZodValidationPipe(ConfirmForgotSchema)) body: ConfirmForgotDto) {
    return this.cognito.confirmForgotPassword(body.email, body.code, body.newPassword);
  }

  /** Step 1 of passwordless email OTP — Cognito emails the user a code. */
  @Public()
  @Post('request-code')
  @HttpCode(200)
  requestCode(@Body(new ZodValidationPipe(RequestCodeSchema)) body: RequestCodeDto) {
    return this.cognito.requestEmailCode(body.email);
  }

  /** Step 2 — submit the 6-digit code, returns tokens + DropTrack profile. */
  @Public()
  @Post('verify-code')
  @HttpCode(200)
  async verifyCode(@Body(new ZodValidationPipe(VerifyCodeSchema)) body: VerifyCodeDto) {
    const tokens = await this.cognito.verifyEmailCode({
      email: body.email,
      code: body.code,
      session: body.session,
    });
    const profile = await this.attachProfile(body.email, tokens);
    return { ...tokens, ...profile };
  }

  // ─────────────────── helpers ───────────────────

  /**
   * Match the Cognito email back to a local users row so the client gets `role`
   * + `userId` in the same response and we don't need a second round-trip.
   *
   * If the email isn't in our users table we surface a 404-ish friendly error;
   * the user needs admin provisioning before they can use DropTrack.
   */
  private async attachProfile(email: string, tokens: CognitoTokens) {
    // Parse `sub` out of the IdToken without verifying — auth.guard re-verifies
    // on the next API call, so this is just for convenience.
    const sub = decodeJwtSubject(tokens.idToken);
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!row) {
      return { provisioned: false, message: 'Logged in to Cognito but no DropTrack profile exists for this email yet.' };
    }
    // Backfill cognitoSub on first successful login.
    if (sub && row.cognitoSub !== sub) {
      await this.db.update(users).set({ cognitoSub: sub }).where(eq(users.id, row.id));
    }
    return {
      provisioned: true,
      userId: row.id,
      email: row.email,
      role: row.role,
    };
  }
}

/** Decode a JWT payload without verification — Cognito access guard will verify on next call. */
function decodeJwtSubject(jwt: string): string | null {
  try {
    const payloadB64 = jwt.split('.')[1];
    const json = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as { sub?: string };
    return parsed.sub ?? null;
  } catch {
    return null;
  }
}
