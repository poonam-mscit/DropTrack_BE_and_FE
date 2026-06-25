import { Logger, Provider } from '@nestjs/common';
import Stripe from 'stripe';

export const STRIPE = Symbol('STRIPE');

export const stripeProvider: Provider = {
  provide: STRIPE,
  useFactory: () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      // Boot in degraded mode — checkout/webhooks will error at request time.
      Logger.warn(
        'STRIPE_SECRET_KEY is not set — Stripe endpoints will fail until configured.',
        'StripeProvider',
      );
      return new Stripe('sk_test_unset_dummy_key', { typescript: true });
    }
    return new Stripe(key, {
      typescript: true,
      appInfo: { name: 'DropTrack', version: '0.0.1' },
    });
  },
};
