/**
 * One-shot script to create the DropTrack seed accounts inside Cognito.
 *
 *   pnpm --filter @droptrack/api cognito:seed
 *
 * Idempotent — re-running is safe; AdminCreateUser throws UsernameExistsException
 * which we swallow.
 *
 * Each user gets a temporary password and is marked `EmailVerified=true` so
 * they can sign in immediately. On first login Cognito will challenge them
 * with NEW_PASSWORD_REQUIRED — the web UI walks them through it.
 */
// Env is loaded via `node --env-file=.env` — see the cognito:seed npm script.
import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';

const SEED_USERS = [
  { email: 'sarah@belleproperty.com.au', name: 'Sarah Nguyen', tempPassword: 'TempSarah!2026' },
  { email: 'ops@droptrack.au', name: 'Ops Console', tempPassword: 'TempOps!2026' },
  { email: 'james@droptrack.au', name: 'James Kowalski', tempPassword: 'TempJames!2026' },
  { email: 'maya@droptrack.au', name: 'Maya Tan', tempPassword: 'TempMaya!2026' },
];

async function main() {
  const region = process.env.COGNITO_REGION ?? process.env.AWS_REGION;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (!region || !userPoolId) {
    throw new Error('COGNITO_REGION and COGNITO_USER_POOL_ID must be set');
  }
  const client = new CognitoIdentityProviderClient({ region });

  for (const u of SEED_USERS) {
    try {
      await client.send(
        new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: u.email,
          MessageAction: 'SUPPRESS', // don't email the temp password — we print it below
          UserAttributes: [
            { Name: 'email', Value: u.email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: u.name },
          ],
        }),
      );
      // Set a *permanent* temp password so the first-login flow uses it.
      await client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: userPoolId,
          Username: u.email,
          Password: u.tempPassword,
          Permanent: false, // forces NEW_PASSWORD_REQUIRED challenge
        }),
      );
      console.log(`✓ created ${u.email}  temp password: ${u.tempPassword}`);
    } catch (err) {
      if (err instanceof UsernameExistsException) {
        console.log(`• exists  ${u.email}  (skipped)`);
      } else {
        console.error(`✗ failed  ${u.email}:`, (err as Error).message);
      }
    }
  }

  console.log('\nDone. First login will force a password change.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
