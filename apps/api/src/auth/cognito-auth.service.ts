/**
 * Cognito auth service — wraps InitiateAuth + password reset flows.
 *
 * Handles the SECRET_HASH wrinkle: if the app client was created WITH a secret,
 * every call must include HMAC-SHA256(username + clientId, key=clientSecret).
 * If created WITHOUT a secret, omit it entirely.
 */
import { createHmac } from 'node:crypto';
import {
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminSetUserPasswordCommand,
  AuthFlowType,
  CognitoIdentityProviderClient,
  CodeMismatchException,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ExpiredCodeException,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  InvalidPasswordException,
  NotAuthorizedException,
  ResendConfirmationCodeCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  UsernameExistsException,
  ChallengeNameType,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  Injectable,
  Logger,
  UnauthorizedException,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';

export interface CognitoTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

@Injectable()
export class CognitoAuthService {
  private readonly logger = new Logger(CognitoAuthService.name);
  private readonly client: CognitoIdentityProviderClient | null;
  private readonly clientId = process.env.COGNITO_CLIENT_ID ?? '';
  private readonly clientSecret = process.env.COGNITO_CLIENT_SECRET ?? '';
  private readonly userPoolId = process.env.COGNITO_USER_POOL_ID ?? '';
  private readonly region = process.env.COGNITO_REGION ?? process.env.AWS_REGION ?? 'ap-southeast-2';

  constructor() {
    if (!this.clientId) {
      this.client = null;
      this.logger.warn('Cognito disabled — COGNITO_CLIENT_ID not set. /auth routes will 503.');
      return;
    }
    this.client = new CognitoIdentityProviderClient({ region: this.region });
    this.logger.log(`Cognito auth ready · region ${this.region} · secretHash=${this.clientSecret ? 'on' : 'off'}`);
  }

  isEnabled() {
    return this.client !== null;
  }

  /** USER_PASSWORD_AUTH flow — returns tokens, or surfaces NEW_PASSWORD_REQUIRED. */
  async login(email: string, password: string): Promise<CognitoTokens> {
    const client = this.requireClient();
    try {
      const res = await client.send(
        new InitiateAuthCommand({
          AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
          ClientId: this.clientId,
          AuthParameters: {
            USERNAME: email,
            PASSWORD: password,
            ...(this.clientSecret ? { SECRET_HASH: this.secretHash(email) } : {}),
          },
        }),
      );

      if (res.ChallengeName === ChallengeNameType.NEW_PASSWORD_REQUIRED) {
        // First-login flow — caller must POST /auth/new-password with `session`.
        throw new BadRequestException({
          code: 'NEW_PASSWORD_REQUIRED',
          session: res.Session,
          message: 'A new password is required for this account.',
        });
      }

      const auth = res.AuthenticationResult;
      if (!auth?.AccessToken || !auth?.IdToken) {
        throw new UnauthorizedException('Cognito returned no tokens');
      }
      return {
        accessToken: auth.AccessToken,
        idToken: auth.IdToken,
        refreshToken: auth.RefreshToken ?? null,
        expiresIn: auth.ExpiresIn ?? 3600,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      if (err instanceof NotAuthorizedException) {
        throw new UnauthorizedException('Incorrect email or password');
      }
      this.logger.warn(`Cognito login failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Login failed');
    }
  }

  /** Complete NEW_PASSWORD_REQUIRED challenge (forced first-time password reset). */
  async setNewPassword(email: string, newPassword: string, session: string): Promise<CognitoTokens> {
    const client = this.requireClient();
    const res = await client.send(
      new RespondToAuthChallengeCommand({
        ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
        ClientId: this.clientId,
        Session: session,
        ChallengeResponses: {
          USERNAME: email,
          NEW_PASSWORD: newPassword,
          ...(this.clientSecret ? { SECRET_HASH: this.secretHash(email) } : {}),
        },
      }),
    );
    const auth = res.AuthenticationResult;
    if (!auth?.AccessToken || !auth?.IdToken) {
      throw new UnauthorizedException('Cognito returned no tokens after new password');
    }
    return {
      accessToken: auth.AccessToken,
      idToken: auth.IdToken,
      refreshToken: auth.RefreshToken ?? null,
      expiresIn: auth.ExpiresIn ?? 3600,
    };
  }

  /** Exchange a refresh token for a fresh access+id token. */
  async refresh(refreshToken: string, email: string): Promise<CognitoTokens> {
    const client = this.requireClient();
    try {
      const res = await client.send(
        new InitiateAuthCommand({
          AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
          ClientId: this.clientId,
          AuthParameters: {
            REFRESH_TOKEN: refreshToken,
            ...(this.clientSecret ? { SECRET_HASH: this.secretHash(email) } : {}),
          },
        }),
      );
      const auth = res.AuthenticationResult;
      if (!auth?.AccessToken || !auth?.IdToken) {
        throw new UnauthorizedException('Cognito refresh returned no tokens');
      }
      return {
        accessToken: auth.AccessToken,
        idToken: auth.IdToken,
        refreshToken: auth.RefreshToken ?? refreshToken, // refresh usually not rotated
        expiresIn: auth.ExpiresIn ?? 3600,
      };
    } catch (err) {
      if (err instanceof NotAuthorizedException) {
        throw new UnauthorizedException('Refresh token expired or invalid');
      }
      this.logger.warn(`Cognito refresh failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Refresh failed');
    }
  }

  async forgotPassword(email: string) {
    const client = this.requireClient();
    await client.send(
      new ForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        ...(this.clientSecret ? { SecretHash: this.secretHash(email) } : {}),
      }),
    );
    return { sent: true };
  }

  async confirmForgotPassword(email: string, code: string, newPassword: string) {
    const client = this.requireClient();
    await client.send(
      new ConfirmForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
        ...(this.clientSecret ? { SecretHash: this.secretHash(email) } : {}),
      }),
    );
    return { confirmed: true };
  }

  // ─────────────────── passwordless email OTP ───────────────────

  /**
   * Kick off Cognito's USER_AUTH flow with EMAIL_OTP. Cognito emails the user
   * a 6-digit code and returns a `Session` we'll hand back in verifyEmailCode.
   *
   * Requires the user pool's app client to have "Email message one-time password"
   * enabled in the Authentication flow settings.
   */
  async requestEmailCode(email: string): Promise<{ session: string; deliveryDestination?: string }> {
    const client = this.requireClient();
    try {
      const res = await client.send(
        new InitiateAuthCommand({
          AuthFlow: 'USER_AUTH' as AuthFlowType,
          ClientId: this.clientId,
          AuthParameters: {
            USERNAME: email,
            PREFERRED_CHALLENGE: 'EMAIL_OTP',
            ...(this.clientSecret ? { SECRET_HASH: this.secretHash(email) } : {}),
          },
        }),
      );
      if (!res.Session) {
        throw new BadRequestException('Cognito did not return a session for the OTP challenge.');
      }
      return {
        session: res.Session,
        deliveryDestination:
          (res.ChallengeParameters?.CODE_DELIVERY_DESTINATION as string | undefined) ?? email,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const name = (err as { name?: string }).name;
      if (name === 'UserNotFoundException') {
        // Don't reveal user existence — pretend it worked, but tell client to wait silently.
        return { session: 'no-user', deliveryDestination: email };
      }
      if (name === 'InvalidParameterException') {
        throw new BadRequestException(
          'Email OTP is not enabled on this user pool. Ask the admin to enable EMAIL_OTP in the app client auth flows.',
        );
      }
      this.logger.warn(`requestEmailCode failed: ${(err as Error).message}`);
      throw new BadRequestException('Could not send code. Please try again.');
    }
  }

  /**
   * Submit the 6-digit code Cognito emailed; returns full token set on success.
   */
  async verifyEmailCode(input: { email: string; code: string; session: string }): Promise<CognitoTokens> {
    if (input.session === 'no-user') {
      // We faked acceptance in requestEmailCode for unknown users; reject here.
      throw new UnauthorizedException('Invalid code.');
    }
    const client = this.requireClient();
    try {
      const res = await client.send(
        new RespondToAuthChallengeCommand({
          ChallengeName: 'EMAIL_OTP' as ChallengeNameType,
          ClientId: this.clientId,
          Session: input.session,
          ChallengeResponses: {
            USERNAME: input.email,
            EMAIL_OTP_CODE: input.code,
            ...(this.clientSecret ? { SECRET_HASH: this.secretHash(input.email) } : {}),
          },
        }),
      );
      const auth = res.AuthenticationResult;
      if (!auth?.AccessToken || !auth?.IdToken) {
        throw new UnauthorizedException('Cognito returned no tokens after OTP.');
      }
      return {
        accessToken: auth.AccessToken,
        idToken: auth.IdToken,
        refreshToken: auth.RefreshToken ?? null,
        expiresIn: auth.ExpiresIn ?? 3600,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      const name = (err as { name?: string }).name;
      if (name === 'NotAuthorizedException' || name === 'CodeMismatchException') {
        throw new UnauthorizedException('Invalid or expired code.');
      }
      this.logger.warn(`verifyEmailCode failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Could not verify code.');
    }
  }

  // ─────────────────── self-serve signup ───────────────────

  /**
   * Public signup — registers the account and asks Cognito to email a
   * verification code. The user must call confirmSignup() with that code
   * before they can sign in.
   *
   * Returns `{ deliveryDestination, deliveryMedium }` so the UI can say
   * "We emailed s***h@belleproperty.com.au."
   */
  async signup(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
  }): Promise<{ deliveryDestination?: string; deliveryMedium?: string }> {
    const client = this.requireClient();

    const userAttrs: Array<{ Name: string; Value: string }> = [
      { Name: 'email', Value: input.email },
      { Name: 'name', Value: `${input.firstName} ${input.lastName}`.trim() },
      { Name: 'given_name', Value: input.firstName },
      { Name: 'family_name', Value: input.lastName },
    ];
    if (input.phoneNumber) {
      userAttrs.push({ Name: 'phone_number', Value: input.phoneNumber });
    }

    try {
      const res = await client.send(
        new SignUpCommand({
          ClientId: this.clientId,
          Username: input.email,
          Password: input.password,
          UserAttributes: userAttrs,
          ...(this.clientSecret ? { SecretHash: this.secretHash(input.email) } : {}),
        }),
      );
      this.logger.log(
        `Cognito SignUp ok · ${input.email} · code sent to ${res.CodeDeliveryDetails?.Destination} via ${res.CodeDeliveryDetails?.DeliveryMedium}`,
      );
      return {
        deliveryDestination: res.CodeDeliveryDetails?.Destination,
        deliveryMedium: res.CodeDeliveryDetails?.DeliveryMedium,
      };
    } catch (err) {
      if (err instanceof UsernameExistsException) {
        throw new BadRequestException('An account with this email already exists. Try signing in.');
      }
      if (err instanceof InvalidPasswordException) {
        throw new BadRequestException(
          'Password does not meet our policy. Use at least 10 characters with upper, lower, number and symbol.',
        );
      }
      this.logger.warn(`Cognito SignUp failed: ${(err as Error).message}`);
      throw new BadRequestException(
        (err as Error).message || 'Could not create account. Please try again.',
      );
    }
  }

  /** Confirm a freshly signed-up account using the 6-digit code from email. */
  async confirmSignup(input: { email: string; code: string }) {
    const client = this.requireClient();
    try {
      await client.send(
        new ConfirmSignUpCommand({
          ClientId: this.clientId,
          Username: input.email,
          ConfirmationCode: input.code,
          ...(this.clientSecret ? { SecretHash: this.secretHash(input.email) } : {}),
        }),
      );
      this.logger.log(`Cognito ConfirmSignUp ok · ${input.email}`);
      return { confirmed: true };
    } catch (err) {
      if (err instanceof CodeMismatchException) {
        throw new BadRequestException('That code is incorrect. Double-check your email.');
      }
      if (err instanceof ExpiredCodeException) {
        throw new BadRequestException('That code has expired. Tap "Resend" to get a new one.');
      }
      const name = (err as { name?: string }).name;
      if (name === 'NotAuthorizedException') {
        throw new BadRequestException('This account is already confirmed. Try signing in.');
      }
      this.logger.warn(`ConfirmSignUp failed: ${(err as Error).message}`);
      throw new BadRequestException('Could not verify code. Please try again.');
    }
  }

  /** Ask Cognito to email a fresh verification code (e.g. if the user lost the first). */
  async resendSignupCode(email: string) {
    const client = this.requireClient();
    try {
      const res = await client.send(
        new ResendConfirmationCodeCommand({
          ClientId: this.clientId,
          Username: email,
          ...(this.clientSecret ? { SecretHash: this.secretHash(email) } : {}),
        }),
      );
      return {
        sent: true,
        deliveryDestination: res.CodeDeliveryDetails?.Destination,
      };
    } catch (err) {
      this.logger.warn(`ResendConfirmationCode failed: ${(err as Error).message}`);
      throw new BadRequestException('Could not resend code. Please try again.');
    }
  }

  // ─────────────────── admin user provisioning ───────────────────

  /**
   * Create a new Cognito user with a one-time temp password. The user must
   * change their password on first login (NEW_PASSWORD_REQUIRED challenge).
   * Returns the temp password so the caller can show it once to the admin.
   *
   * Idempotent — re-running with the same email returns `{ existed: true }`.
   */
  async adminCreateUser(input: { email: string; name?: string }): Promise<{
    existed: boolean;
    tempPassword: string;
  }> {
    const client = this.requireClient();
    if (!this.userPoolId) {
      throw new ServiceUnavailableException('COGNITO_USER_POOL_ID not configured');
    }
    const tempPassword = generateTempPassword();

    try {
      await client.send(
        new AdminCreateUserCommand({
          UserPoolId: this.userPoolId,
          Username: input.email,
          MessageAction: 'SUPPRESS', // we surface the password to the admin, not the user inbox
          UserAttributes: [
            { Name: 'email', Value: input.email },
            { Name: 'email_verified', Value: 'true' },
            ...(input.name ? [{ Name: 'name', Value: input.name }] : []),
          ],
        }),
      );
      await client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: this.userPoolId,
          Username: input.email,
          Password: tempPassword,
          Permanent: false, // forces NEW_PASSWORD_REQUIRED on first login
        }),
      );
      return { existed: false, tempPassword };
    } catch (err) {
      if (err instanceof UsernameExistsException) {
        return { existed: true, tempPassword: '' };
      }
      this.logger.warn(`Cognito adminCreateUser failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async adminDisableUser(email: string) {
    const client = this.requireClient();
    if (!this.userPoolId) {
      throw new ServiceUnavailableException('COGNITO_USER_POOL_ID not configured');
    }
    await client.send(
      new AdminDisableUserCommand({ UserPoolId: this.userPoolId, Username: email }),
    );
    return { disabled: true };
  }

  async adminEnableUser(email: string) {
    const client = this.requireClient();
    if (!this.userPoolId) {
      throw new ServiceUnavailableException('COGNITO_USER_POOL_ID not configured');
    }
    await client.send(
      new AdminEnableUserCommand({ UserPoolId: this.userPoolId, Username: email }),
    );
    return { enabled: true };
  }

  // ─────────────────── helpers ───────────────────

  private requireClient(): CognitoIdentityProviderClient {
    if (!this.client) {
      throw new ServiceUnavailableException('Cognito is not configured on this server');
    }
    return this.client;
  }

  /** HMAC-SHA256(username + clientId, key=clientSecret) → base64 */
  private secretHash(username: string): string {
    return createHmac('sha256', this.clientSecret)
      .update(username + this.clientId)
      .digest('base64');
  }
}

/**
 * Strong one-time password that meets the default Cognito password policy:
 * ≥8 chars · upper · lower · number · symbol.
 */
function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  const base = [pick(upper), pick(upper), pick(lower), pick(lower), pick(digits), pick(digits), pick(symbols), pick(symbols)];
  // Add 4 more random chars then shuffle.
  const all = upper + lower + digits + symbols;
  for (let i = 0; i < 4; i++) base.push(pick(all));
  return base.sort(() => Math.random() - 0.5).join('');
}
