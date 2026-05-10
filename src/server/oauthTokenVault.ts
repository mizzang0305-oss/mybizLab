import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const TOKEN_ENCRYPTION_KEY_ENV_NAME = 'TOKEN_ENCRYPTION_KEY';
export const OAUTH_TOKEN_CIPHERTEXT_VERSION = 'mybiz-oauth-token-v1';

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_BYTES = 16;
const IV_BYTES = 12;
const MIN_KEY_BYTES = 32;

export type TokenVaultEnv = Partial<Record<string, string | undefined>>;

export type TokenVaultReadiness =
  | {
      algorithm: typeof ALGORITHM;
      keyByteLength: number;
      minKeyBytes: typeof MIN_KEY_BYTES;
      missingEnvNames: [];
      ready: true;
      version: typeof OAUTH_TOKEN_CIPHERTEXT_VERSION;
    }
  | {
      algorithm: typeof ALGORITHM;
      error: string;
      keyByteLength: number;
      minKeyBytes: typeof MIN_KEY_BYTES;
      missingEnvNames: [typeof TOKEN_ENCRYPTION_KEY_ENV_NAME];
      ready: false;
      version: typeof OAUTH_TOKEN_CIPHERTEXT_VERSION;
    };

export type EncryptionKeyValidation =
  | {
      byteLength: number;
      ok: true;
    }
  | {
      byteLength: number;
      error: string;
      ok: false;
    };

function readProcessEnv(): TokenVaultEnv {
  if (typeof process === 'undefined' || !process.env) {
    return {};
  }

  return process.env;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getKeyMaterial(env: TokenVaultEnv = readProcessEnv()) {
  return normalizeText(env[TOKEN_ENCRYPTION_KEY_ENV_NAME]);
}

function getUtf8ByteLength(value: string) {
  return Buffer.byteLength(value, 'utf8');
}

function toBase64Url(value: Buffer) {
  return value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

export function validateEncryptionKey(key: unknown): EncryptionKeyValidation {
  const normalized = normalizeText(key);
  const byteLength = getUtf8ByteLength(normalized);
  if (!normalized) {
    return {
      byteLength,
      error: `${TOKEN_ENCRYPTION_KEY_ENV_NAME} is required for OAuth token storage.`,
      ok: false,
    };
  }

  if (byteLength < MIN_KEY_BYTES) {
    return {
      byteLength,
      error: `${TOKEN_ENCRYPTION_KEY_ENV_NAME} must be at least ${MIN_KEY_BYTES} bytes.`,
      ok: false,
    };
  }

  return { byteLength, ok: true };
}

export function getTokenVaultReadiness(env: TokenVaultEnv = readProcessEnv()): TokenVaultReadiness {
  const keyMaterial = getKeyMaterial(env);
  const validation = validateEncryptionKey(keyMaterial);
  if (!validation.ok) {
    return {
      algorithm: ALGORITHM,
      error: validation.error,
      keyByteLength: validation.byteLength,
      minKeyBytes: MIN_KEY_BYTES,
      missingEnvNames: [TOKEN_ENCRYPTION_KEY_ENV_NAME],
      ready: false,
      version: OAUTH_TOKEN_CIPHERTEXT_VERSION,
    };
  }

  return {
    algorithm: ALGORITHM,
    keyByteLength: validation.byteLength,
    minKeyBytes: MIN_KEY_BYTES,
    missingEnvNames: [],
    ready: true,
    version: OAUTH_TOKEN_CIPHERTEXT_VERSION,
  };
}

function deriveAesKey(env?: TokenVaultEnv) {
  const keyMaterial = getKeyMaterial(env);
  const validation = validateEncryptionKey(keyMaterial);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return createHash('sha256').update(Buffer.from(keyMaterial, 'utf8')).digest();
}

export function encryptOAuthToken(plainText: string, options: { env?: TokenVaultEnv } = {}) {
  const token = normalizeText(plainText);
  if (!token) {
    throw new Error('OAuth token plaintext is required.');
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, deriveAesKey(options.env), iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    OAUTH_TOKEN_CIPHERTEXT_VERSION,
    toBase64Url(iv),
    toBase64Url(authTag),
    toBase64Url(encrypted),
  ].join(':');
}

export function decryptOAuthToken(encryptedText: string, options: { env?: TokenVaultEnv } = {}) {
  const encrypted = normalizeText(encryptedText);
  const [version, ivText, authTagText, cipherText] = encrypted.split(':');
  if (version !== OAUTH_TOKEN_CIPHERTEXT_VERSION || !ivText || !authTagText || !cipherText) {
    throw new Error('Unable to decrypt OAuth token.');
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, deriveAesKey(options.env), fromBase64Url(ivText), {
      authTagLength: AUTH_TAG_BYTES,
    });
    decipher.setAuthTag(fromBase64Url(authTagText));
    return Buffer.concat([decipher.update(fromBase64Url(cipherText)), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Unable to decrypt OAuth token.');
  }
}

export function maskTokenForDebug(token: string) {
  const normalized = normalizeText(token);
  if (!normalized) {
    return 'token(len=0, sha256=empty)';
  }

  const digest = createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 12);
  return `token(len=${getUtf8ByteLength(normalized)}, sha256=${digest})`;
}
