import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import type { ObjectStorageAdapter, ObjectStorageReceipt } from '../../../domain/mybiz/serviceOs.js';

const DEFAULT_MAX_SIZE_BYTES = 25 * 1024 * 1024;
const DEFAULT_UPLOAD_TTL_MS = 5 * 60 * 1000;
const MAX_READ_TTL_SECONDS = 15 * 60;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_PATTERN = /^stores\/([A-Za-z0-9_-]{1,64})\/jobs\/([A-Za-z0-9_-]{1,64})\/revisions\/([1-9][0-9]*)\/(original|derived\/(?:thumbnail|content))\/([0-9a-f-]{36})$/;

export const LOCAL_STORAGE_ALLOWED_MIME_TYPES = [
  'application/json',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
] as const;

export type EvidenceObjectNamespace = 'original' | 'derived/thumbnail' | 'derived/content';

export interface EvidenceObjectKeyInput {
  storeId: string;
  jobId: string;
  revisionNumber: number;
  namespace: EvidenceObjectNamespace;
}

interface CapabilityRecord {
  objectKey: string;
  expiresAt: number;
}

interface UploadCapabilityRecord extends CapabilityRecord {
  mimeType: string;
  sizeBytes: number;
}

interface StoredMetadata extends ObjectStorageReceipt {
  storageProvider: 'local';
}

export interface LocalObjectStorageAdapterOptions {
  rootDir: string;
  maxSizeBytes?: number;
  allowedMimeTypes?: readonly string[];
  uploadTtlMs?: number;
  now?: () => number;
}

export function createEvidenceObjectKey(input: EvidenceObjectKeyInput) {
  assertSafeId(input.storeId, 'storeId');
  assertSafeId(input.jobId, 'jobId');
  if (!Number.isSafeInteger(input.revisionNumber) || input.revisionNumber < 1) {
    throw new Error('STORAGE_REVISION_INVALID');
  }

  return `stores/${input.storeId}/jobs/${input.jobId}/revisions/${input.revisionNumber}/${input.namespace}/${randomUUID()}`;
}

export class LocalObjectStorageAdapter implements ObjectStorageAdapter {
  private readonly rootDir: string;
  private readonly maxSizeBytes: number;
  private readonly allowedMimeTypes: ReadonlySet<string>;
  private readonly uploadTtlMs: number;
  private readonly now: () => number;
  private readonly uploadCapabilities = new Map<string, UploadCapabilityRecord>();
  private readonly readCapabilities = new Map<string, CapabilityRecord>();

  constructor(options: LocalObjectStorageAdapterOptions) {
    if (!isAbsolute(options.rootDir)) throw new Error('STORAGE_ROOT_ABSOLUTE_REQUIRED');
    if (!Number.isSafeInteger(options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES) || (options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES) < 1) {
      throw new Error('STORAGE_MAX_SIZE_INVALID');
    }

    this.rootDir = resolve(options.rootDir);
    this.maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
    this.allowedMimeTypes = new Set(options.allowedMimeTypes ?? LOCAL_STORAGE_ALLOWED_MIME_TYPES);
    this.uploadTtlMs = options.uploadTtlMs ?? DEFAULT_UPLOAD_TTL_MS;
    this.now = options.now ?? Date.now;
  }

  async put(input: { objectKey: string; bytes: Uint8Array; mimeType: string }): Promise<ObjectStorageReceipt> {
    this.assertWriteInput(input);
    const objectPath = this.resolveObjectPath(input.objectKey);
    const metadataPath = this.metadataPath(objectPath);
    const sha256 = await this.hash({ bytes: input.bytes });
    await mkdir(dirname(objectPath), { recursive: true, mode: 0o700 });
    await writeFile(objectPath, input.bytes, { flag: 'wx', mode: 0o600 });
    try {
      const persistedBytes = new Uint8Array(await readFile(objectPath));
      const persistedSha256 = await this.hash({ bytes: persistedBytes });
      if (persistedBytes.byteLength !== input.bytes.byteLength || persistedSha256 !== sha256) {
        throw new Error('STORAGE_WRITE_VERIFY_FAILED');
      }
      const storedAt = new Date(this.now()).toISOString();
      const receipt: StoredMetadata = {
        storageProvider: 'local',
        objectKey: input.objectKey,
        mimeType: input.mimeType,
        sizeBytes: input.bytes.byteLength,
        sha256,
        etag: sha256,
        storedAt,
        verifiedAt: new Date(this.now()).toISOString(),
      };
      await writeFile(metadataPath, JSON.stringify(receipt), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      if (!await this.verifyReceipt(receipt)) throw new Error('STORAGE_RECEIPT_VERIFY_FAILED');
      return receipt;
    } catch (error) {
      await unlink(metadataPath).catch(() => undefined);
      await unlink(objectPath).catch(() => undefined);
      throw error;
    }
  }

  async getSignedUploadUrl(input: { objectKey: string; mimeType: string; sizeBytes: number }): Promise<string> {
    this.assertWriteDeclaration(input);
    const token = randomBytes(32).toString('hex');
    this.uploadCapabilities.set(this.hashToken(token), {
      ...input,
      expiresAt: this.now() + this.uploadTtlMs,
    });
    return `mybiz-local://upload/${token}`;
  }

  async consumeSignedUploadUrl(input: {
    url: string;
    objectKey: string;
    mimeType: string;
    bytes: Uint8Array;
  }): Promise<ObjectStorageReceipt> {
    const tokenHash = this.readCapabilityToken(input.url, 'upload');
    const capability = this.uploadCapabilities.get(tokenHash);
    this.uploadCapabilities.delete(tokenHash);
    if (!capability || capability.expiresAt <= this.now()) throw new Error('STORAGE_UPLOAD_CAPABILITY_INVALID');
    if (
      capability.objectKey !== input.objectKey
      || capability.mimeType !== input.mimeType
      || capability.sizeBytes !== input.bytes.byteLength
    ) {
      throw new Error('STORAGE_UPLOAD_CAPABILITY_MISMATCH');
    }
    return this.put(input);
  }

  async getSignedReadUrl(input: { objectKey: string; expiresInSeconds: number }): Promise<string> {
    this.resolveObjectPath(input.objectKey);
    if (!Number.isSafeInteger(input.expiresInSeconds) || input.expiresInSeconds < 1 || input.expiresInSeconds > MAX_READ_TTL_SECONDS) {
      throw new Error('STORAGE_READ_TTL_INVALID');
    }
    await stat(this.resolveObjectPath(input.objectKey));
    const token = randomBytes(32).toString('hex');
    this.readCapabilities.set(this.hashToken(token), {
      objectKey: input.objectKey,
      expiresAt: this.now() + input.expiresInSeconds * 1000,
    });
    return `mybiz-local://read/${token}`;
  }

  async consumeSignedReadUrl(url: string): Promise<Uint8Array> {
    const tokenHash = this.readCapabilityToken(url, 'read');
    const capability = this.readCapabilities.get(tokenHash);
    this.readCapabilities.delete(tokenHash);
    if (!capability || capability.expiresAt <= this.now()) throw new Error('STORAGE_READ_CAPABILITY_INVALID');
    return new Uint8Array(await readFile(this.resolveObjectPath(capability.objectKey)));
  }

  async deleteDerived(input: { objectKey: string }): Promise<void> {
    const parsed = this.parseObjectKey(input.objectKey);
    if (!parsed.namespace.startsWith('derived/')) throw new Error('STORAGE_ORIGINAL_DELETE_FORBIDDEN');
    const objectPath = this.resolveObjectPath(input.objectKey);
    await unlink(this.metadataPath(objectPath));
    await unlink(objectPath);
  }

  async metadata(input: { objectKey: string }): Promise<Record<string, unknown>> {
    const objectPath = this.resolveObjectPath(input.objectKey);
    const parsed = JSON.parse(await readFile(this.metadataPath(objectPath), 'utf8')) as StoredMetadata;
    if (parsed.objectKey !== input.objectKey || parsed.storageProvider !== 'local') throw new Error('STORAGE_METADATA_INVALID');
    return { ...parsed };
  }

  async hash(input: { bytes: Uint8Array }): Promise<string> {
    return createHash('sha256').update(input.bytes).digest('hex');
  }

  async verifyReceipt(receipt: ObjectStorageReceipt): Promise<boolean> {
    try {
      const bytes = new Uint8Array(await readFile(this.resolveObjectPath(receipt.objectKey)));
      const metadata = await this.metadata({ objectKey: receipt.objectKey }) as unknown as StoredMetadata;
      const sha256 = await this.hash({ bytes });
      return receipt.storageProvider === 'local'
        && receipt.etag === sha256
        && receipt.sha256 === sha256
        && receipt.sizeBytes === bytes.byteLength
        && metadata.sha256 === sha256
        && metadata.sizeBytes === bytes.byteLength
        && metadata.mimeType === receipt.mimeType
        && metadata.storedAt === receipt.storedAt
        && metadata.verifiedAt === receipt.verifiedAt;
    } catch {
      return false;
    }
  }

  private assertWriteDeclaration(input: { objectKey: string; mimeType: string; sizeBytes: number }) {
    this.resolveObjectPath(input.objectKey);
    if (!this.allowedMimeTypes.has(input.mimeType)) throw new Error('STORAGE_MIME_TYPE_FORBIDDEN');
    if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > this.maxSizeBytes) {
      throw new Error('STORAGE_SIZE_LIMIT_EXCEEDED');
    }
  }

  private assertWriteInput(input: { objectKey: string; bytes: Uint8Array; mimeType: string }) {
    this.assertWriteDeclaration({
      objectKey: input.objectKey,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
    });
  }

  private resolveObjectPath(objectKey: string) {
    this.parseObjectKey(objectKey);
    const candidate = resolve(this.rootDir, ...objectKey.split('/'));
    const pathFromRoot = relative(this.rootDir, candidate);
    if (!pathFromRoot || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
      throw new Error('STORAGE_OBJECT_KEY_ESCAPE');
    }
    return candidate;
  }

  private parseObjectKey(objectKey: string) {
    if (objectKey.includes('..') || objectKey.includes('\\') || objectKey.includes('%') || isAbsolute(objectKey)) {
      throw new Error('STORAGE_OBJECT_KEY_INVALID');
    }
    const match = KEY_PATTERN.exec(objectKey);
    if (!match) throw new Error('STORAGE_OBJECT_KEY_INVALID');
    return { storeId: match[1], jobId: match[2], revisionNumber: Number(match[3]), namespace: match[4] };
  }

  private metadataPath(objectPath: string) {
    return `${objectPath}.metadata.json`;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private readCapabilityToken(url: string, expectedHost: 'upload' | 'read') {
    try {
      const parsed = new URL(url);
      const token = parsed.pathname.slice(1);
      if (parsed.protocol !== 'mybiz-local:' || parsed.hostname !== expectedHost || !/^[a-f0-9]{64}$/.test(token)) {
        throw new Error('invalid');
      }
      return this.hashToken(token);
    } catch {
      throw new Error('STORAGE_CAPABILITY_URL_INVALID');
    }
  }
}

function assertSafeId(value: string, name: string) {
  if (!ID_PATTERN.test(value) || value === '.' || value === '..') {
    throw new Error(`STORAGE_${name.toUpperCase()}_INVALID`);
  }
}
