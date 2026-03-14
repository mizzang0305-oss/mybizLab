import { readServerEnv, requireServerEnv } from '@/server/serverEnv';

export function getPortOneWebhookSecret() {
  return requireServerEnv('PORTONE_WEBHOOK_SECRET', 'PortOne webhook signature verification on /api/billing/webhook');
}

export function getPortOneApiSecret() {
  return requireServerEnv('PORTONE_V2_API_SECRET', 'PortOne payment verification and billing-key server operations');
}

export function getPortOneServerEnvStatus() {
  return {
    apiSecretConfigured: Boolean(readServerEnv('PORTONE_V2_API_SECRET')),
    webhookSecretConfigured: Boolean(readServerEnv('PORTONE_WEBHOOK_SECRET')),
  };
}
