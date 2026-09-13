import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createEvidenceObjectKey,
  LocalObjectStorageAdapter,
} from '@/server/mybiz/storage/localObjectStorageAdapter';

const roots: string[] = [];

async function createAdapter(options: { maxSizeBytes?: number; now?: () => number } = {}) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mybiz-storage-'));
  roots.push(rootDir);
  return {
    adapter: new LocalObjectStorageAdapter({ rootDir, ...options }),
    rootDir,
  };
}

function key(namespace: 'original' | 'derived/thumbnail' | 'derived/content' = 'original') {
  return createEvidenceObjectKey({
    storeId: 'store_A',
    jobId: 'job_A',
    revisionNumber: 1,
    namespace,
  });
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('LocalObjectStorageAdapter', () => {
  it('writes and reads real bytes with a verifiable SHA-256 receipt', async () => {
    const { adapter } = await createAdapter();
    const objectKey = key();
    const bytes = new TextEncoder().encode('abc');
    const uploadUrl = await adapter.getSignedUploadUrl({ objectKey, mimeType: 'application/json', sizeBytes: bytes.byteLength });
    const receipt = await adapter.consumeSignedUploadUrl({ url: uploadUrl, objectKey, mimeType: 'application/json', bytes });
    const readUrl = await adapter.getSignedReadUrl({ objectKey, expiresInSeconds: 30 });

    expect(new TextDecoder().decode(await adapter.consumeSignedReadUrl(readUrl))).toBe('abc');
    expect(receipt.sha256).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await adapter.verifyReceipt(receipt)).toBe(true);
    expect(await adapter.metadata({ objectKey })).toMatchObject(receipt);
  });

  it('makes upload and read capabilities one-time', async () => {
    const { adapter } = await createAdapter();
    const objectKey = key();
    const bytes = new Uint8Array([1]);
    const uploadUrl = await adapter.getSignedUploadUrl({ objectKey, mimeType: 'image/png', sizeBytes: 1 });
    await adapter.consumeSignedUploadUrl({ url: uploadUrl, objectKey, mimeType: 'image/png', bytes });
    await expect(adapter.consumeSignedUploadUrl({ url: uploadUrl, objectKey, mimeType: 'image/png', bytes })).rejects.toThrow('STORAGE_UPLOAD_CAPABILITY_INVALID');
    const readUrl = await adapter.getSignedReadUrl({ objectKey, expiresInSeconds: 10 });
    await adapter.consumeSignedReadUrl(readUrl);
    await expect(adapter.consumeSignedReadUrl(readUrl)).rejects.toThrow('STORAGE_READ_CAPABILITY_INVALID');
  });

  it('rejects expired capabilities without writing bytes', async () => {
    let now = 1_000;
    const { adapter } = await createAdapter({ now: () => now });
    const objectKey = key();
    const bytes = new Uint8Array([1]);
    const uploadUrl = await adapter.getSignedUploadUrl({ objectKey, mimeType: 'image/png', sizeBytes: 1 });
    now += 5 * 60 * 1000;
    await expect(adapter.consumeSignedUploadUrl({ url: uploadUrl, objectKey, mimeType: 'image/png', bytes })).rejects.toThrow('STORAGE_UPLOAD_CAPABILITY_INVALID');
    await expect(adapter.metadata({ objectKey })).rejects.toThrow();
  });

  it('enforces MIME type, non-empty byte, and size limits', async () => {
    const { adapter } = await createAdapter({ maxSizeBytes: 2 });
    const objectKey = key();
    await expect(adapter.getSignedUploadUrl({ objectKey, mimeType: 'text/html', sizeBytes: 1 })).rejects.toThrow('STORAGE_MIME_TYPE_FORBIDDEN');
    await expect(adapter.put({ objectKey, mimeType: 'image/svg+xml', bytes: new Uint8Array([1]) })).rejects.toThrow('STORAGE_MIME_TYPE_FORBIDDEN');
    await expect(adapter.put({ objectKey, mimeType: 'image/png', bytes: new Uint8Array() })).rejects.toThrow('STORAGE_SIZE_LIMIT_EXCEEDED');
    await expect(adapter.put({ objectKey, mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3]) })).rejects.toThrow('STORAGE_SIZE_LIMIT_EXCEEDED');
  });

  it('binds upload capabilities to key, MIME, and declared byte size', async () => {
    const { adapter } = await createAdapter();
    const objectKey = key();
    const uploadUrl = await adapter.getSignedUploadUrl({ objectKey, mimeType: 'image/png', sizeBytes: 1 });
    await expect(adapter.consumeSignedUploadUrl({
      url: uploadUrl,
      objectKey: createEvidenceObjectKey({ storeId: 'store_B', jobId: 'job_B', revisionNumber: 1, namespace: 'original' }),
      mimeType: 'image/png',
      bytes: new Uint8Array([1]),
    })).rejects.toThrow('STORAGE_UPLOAD_CAPABILITY_MISMATCH');
  });

  it('generates canonical tenant/job/revision keys without filenames', () => {
    const objectKey = createEvidenceObjectKey({ storeId: 'store_A', jobId: 'job_A', revisionNumber: 7, namespace: 'derived/content' });
    expect(objectKey).toMatch(/^stores\/store_A\/jobs\/job_A\/revisions\/7\/derived\/content\/[0-9a-f-]{36}$/);
    expect(objectKey).not.toContain('customer-file');
  });

  it('rejects traversal, absolute, encoded, and backslash object keys', async () => {
    const { adapter } = await createAdapter();
    for (const objectKey of ['../escape', 'C:/escape', '/escape', 'stores/%2e%2e/jobs/a/revisions/1/original/00000000-0000-0000-0000-000000000000', 'stores/a\\b/jobs/a/revisions/1/original/00000000-0000-0000-0000-000000000000']) {
      await expect(adapter.put({ objectKey, mimeType: 'image/png', bytes: new Uint8Array([1]) })).rejects.toThrow('STORAGE_OBJECT_KEY_INVALID');
    }
    expect(() => createEvidenceObjectKey({ storeId: '..', jobId: 'job_A', revisionNumber: 1, namespace: 'original' })).toThrow();
  });

  it('prevents overwrite collisions and preserves the first bytes', async () => {
    const { adapter } = await createAdapter();
    const objectKey = key();
    const first = await adapter.put({ objectKey, mimeType: 'image/png', bytes: new Uint8Array([1]) });
    await expect(adapter.put({ objectKey, mimeType: 'image/png', bytes: new Uint8Array([2]) })).rejects.toThrow();
    expect(await adapter.verifyReceipt(first)).toBe(true);
  });

  it('detects forged receipts and on-disk tampering', async () => {
    const { adapter, rootDir } = await createAdapter();
    const objectKey = key();
    const receipt = await adapter.put({ objectKey, mimeType: 'image/png', bytes: new Uint8Array([1]) });
    expect(await adapter.verifyReceipt({ ...receipt, sizeBytes: 99 })).toBe(false);
    await writeFile(join(rootDir, ...objectKey.split('/')), new Uint8Array([2]));
    expect(await adapter.verifyReceipt(receipt)).toBe(false);
  });

  it('forbids original deletion and only deletes derived objects', async () => {
    const { adapter } = await createAdapter();
    const originalKey = key();
    const original = await adapter.put({ objectKey: originalKey, mimeType: 'image/png', bytes: new Uint8Array([1]) });
    await expect(adapter.deleteDerived({ objectKey: originalKey })).rejects.toThrow('STORAGE_ORIGINAL_DELETE_FORBIDDEN');
    expect(await adapter.verifyReceipt(original)).toBe(true);

    const derivedKey = key('derived/thumbnail');
    await adapter.put({ objectKey: derivedKey, mimeType: 'image/webp', bytes: new Uint8Array([2]) });
    await adapter.deleteDerived({ objectKey: derivedKey });
    await expect(adapter.metadata({ objectKey: derivedKey })).rejects.toThrow();
  });

  it('does not disclose filesystem roots or capability tokens in metadata', async () => {
    const { adapter, rootDir } = await createAdapter();
    const objectKey = key();
    const bytes = new Uint8Array([1]);
    const uploadUrl = await adapter.getSignedUploadUrl({ objectKey, mimeType: 'image/png', sizeBytes: 1 });
    await adapter.consumeSignedUploadUrl({ url: uploadUrl, objectKey, mimeType: 'image/png', bytes });
    const metadata = JSON.stringify(await adapter.metadata({ objectKey }));
    expect(metadata).not.toContain(rootDir);
    expect(metadata).not.toContain(uploadUrl.split('/').at(-1));
    expect(await readFile(join(rootDir, ...objectKey.split('/')))).toEqual(Buffer.from(bytes));
  });
});
