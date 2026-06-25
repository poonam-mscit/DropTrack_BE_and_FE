import { Logger } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

/** Lazy singleton — built only once we know we have a pool configured. */
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

export function getCognitoVerifier() {
  if (verifier) return verifier;

  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!userPoolId || !clientId) {
    Logger.warn(
      'Cognito not configured (COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID). Auth runs in DEV mode.',
      'CognitoVerifier',
    );
    return null;
  }

  verifier = CognitoJwtVerifier.create({
    userPoolId,
    clientId,
    tokenUse: 'access',
  });
  return verifier;
}

export function isCognitoEnabled() {
  return Boolean(process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID);
}
