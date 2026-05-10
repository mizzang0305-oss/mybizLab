import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export type OAuthTokenVaultEnv = Partial<Record<'TOKEN_ENCRYPTION_KEY' | string, string | undefined>>;

export interface OAuthTokenVaultReadiness {
  missingEnvNames: string[];
  ready: boolean;
  status: 'missing_config' | 'ready';
}

export interface OAuthTokenVaultOptions {
  env?: OAuthTokenVaultEnv;
}

const TOKEN_FORMAT_PREFIX = 'oauth:v1:aes-256-gcm';
const TOKEN_KEY_MIN_BYTES = 32;

function readProcessEnv(): OAuthTokenVaultEnv {
  if (typeof process === 'undefined' || !process.env) {
    return {};
  }

  return process.env;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveEnv(options?: OAuthTokenVaultOptions) {
  return options?.env || readProcessEnv();
}

export function validateEncryptionKey(options?: OAuthTokenVaultOptions) {
  const key = normalizeText(resolveEnv(options).TOKEN_ENCRYPTION_KEY);
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY is required before OAuth token storage can be used.');
  }

  if (Buffer.byteLength(key, 'utf8') < TOKEN_KEY_MIN_BYTES) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be at least 32 bytes.');
  }

  return createHash('sha256').update(key).digest();
}

export function getTokenVaultReadiness(options?: OAuthTokenVaultOptions): OAuthTokenVaultReadiness {
  try {
    validateEncryptionKey(options);
    return {
      missingEnvNames: [],
      ready: true,
      status: 'ready',
    };
  } catch {
    return {
      missingEnvNames: ['TOKEN_ENCRYPTION_KEY'],
      ready: false,
      status: 'missing_config',
    };
  }
}

export function encryptOAuthToken(plainText: string, options?: OAuthTokenVaultOptions) {
  const normalized = normalizeText(plainText);
  if (!normalized) {
    throw new Error('OAuth token is required.');
  }

  const key = validateEncryptionKey(options);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedText: [
      TOKEN_FORMAT_PREFIX,
      iv.toString('base64url'),
      authTag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join(':'),
  };
}

export function decryptOAuthToken(encryptedText: string, options?: OAuthTokenVaultOptions) {
  const normalized = normalizeText(encryptedText);
  const [scope, version, algorithm, ivText, tagText, cipherText] = normalized.split(':');
  if (`${scope}:${version}:${algorithm}` !== TOKEN_FORMAT_PREFIX || !ivText || !tagText || !cipherText) {
    throw new Error('OAuth token ciphertext format is not supported.');
  }

  const key = validateEncryptionKey(options);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(cipherText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function maskTokenForDebug(token: string) {
  const normalized = normalizeText(token);
  if (!normalized) {
    return '';
  }

  if (normalized.length <= 8) {
    return '****';
  }

  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}
