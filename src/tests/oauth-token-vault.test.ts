import { describe, expect, it } from 'vitest';

import {
  decryptOAuthToken,
  encryptOAuthToken,
  getTokenVaultReadiness,
  maskTokenForDebug,
  validateEncryptionKey,
} from '@/server/oauthTokenVault';

const validKey = '0123456789abcdef0123456789abcdef';

describe('OAuth token vault', () => {
  it('requires TOKEN_ENCRYPTION_KEY with at least 32 bytes', () => {
    expect(getTokenVaultReadiness({}).ready).toBe(false);
    expect(getTokenVaultReadiness({}).missingEnvNames).toEqual(['TOKEN_ENCRYPTION_KEY']);
    expect(validateEncryptionKey('short-key').ok).toBe(false);
    expect(validateEncryptionKey(validKey).ok).toBe(true);
  });

  it('encrypts and decrypts tokens without exposing the plaintext', () => {
    const plainToken = 'plain-oauth-access-token-should-not-leak';
    const encrypted = encryptOAuthToken(plainToken, { env: { TOKEN_ENCRYPTION_KEY: validKey } });

    expect(encrypted).toContain('mybiz-oauth-token-v1:');
    expect(encrypted).not.toContain(plainToken);
    expect(decryptOAuthToken(encrypted, { env: { TOKEN_ENCRYPTION_KEY: validKey } })).toBe(plainToken);
  });

  it('uses a random IV and rejects decrypting with the wrong key', () => {
    const plainToken = 'same-token-value';
    const first = encryptOAuthToken(plainToken, { env: { TOKEN_ENCRYPTION_KEY: validKey } });
    const second = encryptOAuthToken(plainToken, { env: { TOKEN_ENCRYPTION_KEY: validKey } });

    expect(first).not.toBe(second);
    expect(() =>
      decryptOAuthToken(first, { env: { TOKEN_ENCRYPTION_KEY: 'abcdef0123456789abcdef0123456789' } }),
    ).toThrow(/decrypt/i);
  });

  it('masks debug output without including token fragments', () => {
    const plainToken = 'debug-token-value-should-not-appear';
    const masked = maskTokenForDebug(plainToken);

    expect(masked).toContain('len=');
    expect(masked).toContain('sha256=');
    expect(masked).not.toContain('debug-token');
    expect(masked).not.toContain('appear');
  });
});
