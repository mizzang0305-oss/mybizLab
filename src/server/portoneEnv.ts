import { readBillingEnv } from './billingApiRuntime';

const SERVER_ENV_HINT =
  'Add it to .env.local when using vercel dev, and to Vercel Project Settings > Environment Variables for Development, Preview, and Production.';

export function getPortOneWebhookSecret() {
  const secret = readBillingEnv().webhookSecret;

  if (!secret) {
    throw new Error(
      `Missing required server env PORTONE_WEBHOOK_SECRET for PortOne webhook signature verification on /api/billing/webhook. ${SERVER_ENV_HINT}`,
    );
  }

  return secret;
}

export function getPortOneApiSecret() {
  const secret = readBillingEnv().apiSecret;

  if (!secret) {
    throw new Error(
      `Missing required server env PORTONE_API_SECRET for PortOne payment verification and billing-key server operations. ${SERVER_ENV_HINT}`,
    );
  }

  return secret;
}

export function getPortOneServerEnvStatus() {
  const env = readBillingEnv();

  return {
    apiSecretConfigured: Boolean(env.apiSecret),
    webhookSecretConfigured: Boolean(env.webhookSecret),
  };
}