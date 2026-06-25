import { Logger, Provider } from '@nestjs/common';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

export const BEDROCK = Symbol('BEDROCK');

/**
 * Lazy Bedrock client provider.
 *
 * - If AWS creds + BEDROCK_REGION are present → returns a real BedrockRuntimeClient.
 * - Else → returns null and the service falls back to a deterministic stub.
 *
 * Why null instead of throw: keeps the API booting and lets the report flow work
 * end-to-end (stubbed narrative + real PDF) until you wire AWS creds.
 */
export const bedrockProvider: Provider = {
  provide: BEDROCK,
  useFactory: () => {
    const region = process.env.AWS_BEDROCK_REGION ?? process.env.AWS_REGION;
    if (!region) {
      Logger.warn(
        'AWS_BEDROCK_REGION not set — AI Campaign Reports run in STUB mode (no Bedrock calls).',
        'BedrockProvider',
      );
      return null;
    }
    return new BedrockRuntimeClient({ region });
  },
};

/** Bedrock model id for AU Sydney. */
export const MISTRAL_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? 'mistral.mistral-small-2402-v1:0';
