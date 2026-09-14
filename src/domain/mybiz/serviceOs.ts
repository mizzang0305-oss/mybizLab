export type ServiceVertical = 'cleaning' | 'hair' | 'installation' | 'wig' | 'interior' | 'medical';

export type ContractState = 'NOT_REQUIRED' | 'DRAFT' | 'SENT' | 'ACCEPTED' | 'SIGNED';
export type JobState =
  | 'JOB_CREATED'
  | 'CONTRACT_REQUIRED'
  | 'WORK_READY'
  | 'WORK_IN_PROGRESS'
  | 'WORK_COMPLETED'
  | 'CUSTOMER_CONFIRMED'
  | 'CUSTOMER_CORRECTION_REQUESTED'
  | 'CONFIRMATION_OUTDATED';
export type PaymentState =
  | 'PAYMENT_NOT_REQUESTED'
  | 'PAYMENT_REQUESTED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_PAID'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REFUNDED';
export type EvidenceKind = 'before_photo' | 'during_photo' | 'after_photo' | 'video' | 'document' | 'checklist' | 'other';
export type PublicationChannel = 'website' | 'blog' | 'instagram' | 'tiktok' | 'youtube_shorts';
export type ContentCandidateState = 'DRAFT' | 'GENERATED' | 'REVIEW_REQUIRED' | 'APPROVED' | 'PUBLISH_READY' | 'PUBLISHED' | 'FAILED';

export interface ServiceJob {
  id: string;
  /** Legacy-compatible tenant/business/workspace scope identifier. */
  storeId: string;
  vertical: ServiceVertical;
  serviceName: string;
  requiresContract: boolean;
  contractState: ContractState;
  state: JobState;
  evidenceRevision: number;
  paymentState: PaymentState;
}

export interface EvidenceAsset {
  id: string;
  storeId: string;
  jobId: string;
  uploaderUserId: string;
  kind: EvidenceKind;
  storageProvider: string;
  storageObjectKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  serverReceivedAt: string;
  clientCaptureAt?: string;
  clientTimezone?: string;
  metadata: Record<string, unknown>;
  revisionNumber: number;
  status: 'active' | 'superseded' | 'quarantined';
}

export interface CustomerConfirmation {
  id: string;
  storeId: string;
  jobId: string;
  evidenceRevision: number;
  outcome: 'confirmed' | 'correction_requested';
  confirmedAt: string;
}

export interface ConsentRecord {
  id: string;
  storeId: string;
  jobId: string;
  evidenceRevision: number;
  purpose: 'marketing';
  textVersion: string;
  channels: PublicationChannel[];
  grantedAt: string;
  withdrawnAt?: string;
  actor: 'customer' | 'guardian';
  source: 'secure_link' | 'paper_record' | 'staff_recorded';
}

export interface PublicationPolicyInput {
  channel: PublicationChannel;
  job: ServiceJob;
  confirmation?: CustomerConfirmation;
  consent?: ConsentRecord;
  merchantApproved: boolean;
  medicalVerticalEnabled?: boolean;
  regulatedReviewApproved?: boolean;
}

export interface ConfirmationLinkPolicyInput {
  jobId: string;
  evidenceRevision: number;
  expectedJobId: string;
  expectedEvidenceRevision: number;
  tokenHashMatches: boolean;
  expiresAt: string;
  revokedAt?: string;
  now: string;
}

export interface ObjectStorageReceipt {
  storageProvider: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  etag: string;
  storedAt: string;
  verifiedAt: string;
}

export interface ObjectStorageAdapter {
  put(input: { objectKey: string; bytes: Uint8Array; mimeType: string }): Promise<ObjectStorageReceipt>;
  getSignedUploadUrl(input: { objectKey: string; mimeType: string; sizeBytes: number }): Promise<string>;
  getSignedReadUrl(input: { objectKey: string; expiresInSeconds: number }): Promise<string>;
  deleteDerived(input: { objectKey: string }): Promise<void>;
  metadata(input: { objectKey: string }): Promise<Record<string, unknown>>;
  hash(input: { bytes: Uint8Array }): Promise<string>;
}

export interface VerticalTemplate {
  id: Exclude<ServiceVertical, 'medical'>;
  label: string;
  publicV1: boolean;
  customFields: readonly string[];
}

export const VERTICAL_TEMPLATES: readonly VerticalTemplate[] = [
  { id: 'cleaning', label: '청소', publicV1: true, customFields: ['room', 'area', 'cleaning_type'] },
  { id: 'hair', label: '미용실', publicV1: true, customFields: ['designer', 'service_name', 'hair_style', 'technique'] },
  { id: 'installation', label: '설치·수리', publicV1: true, customFields: ['equipment', 'model', 'install_location'] },
  { id: 'wig', label: '가발', publicV1: false, customFields: ['designer', 'product_type', 'fitting_type', 'style_name'] },
  { id: 'interior', label: '인테리어', publicV1: false, customFields: ['work_area', 'construction_type'] },
] as const;

export const DEFAULT_MEDICAL_VERTICAL_ENABLED = false;

export function canStartWork(job: Pick<ServiceJob, 'requiresContract' | 'contractState'>) {
  if (!job.requiresContract) return true;
  return job.contractState === 'SIGNED' || job.contractState === 'ACCEPTED';
}

export function resolveReadyState(job: Pick<ServiceJob, 'requiresContract' | 'contractState'>): JobState {
  return canStartWork(job) ? 'WORK_READY' : 'CONTRACT_REQUIRED';
}

export function isSameTenant(actorStoreId: string, resourceStoreId: string) {
  return actorStoreId.length > 0 && actorStoreId === resourceStoreId;
}

export function validateConfirmationLink(input: ConfirmationLinkPolicyInput) {
  if (!input.tokenHashMatches || input.revokedAt) return false;
  const now = Date.parse(input.now);
  const expiresAt = Date.parse(input.expiresAt);
  if (!Number.isFinite(now) || !Number.isFinite(expiresAt) || now >= expiresAt) return false;
  return input.jobId === input.expectedJobId && input.evidenceRevision === input.expectedEvidenceRevision;
}

export function resolveJobStateAfterRevision(
  job: ServiceJob,
  confirmations: readonly CustomerConfirmation[],
): ServiceJob {
  const nextRevision = job.evidenceRevision + 1;
  const confirmedPreviousRevision = confirmations.some(
    (confirmation) => confirmation.jobId === job.id && confirmation.outcome === 'confirmed' && confirmation.evidenceRevision <= job.evidenceRevision,
  );

  return {
    ...job,
    evidenceRevision: nextRevision,
    state: confirmedPreviousRevision ? 'CONFIRMATION_OUTDATED' : 'WORK_COMPLETED',
  };
}

export function isPublicationEligible(input: PublicationPolicyInput) {
  const { channel, confirmation, consent, job, merchantApproved } = input;

  if (!merchantApproved || !confirmation || !consent || consent.withdrawnAt) return false;
  if (confirmation.outcome !== 'confirmed') return false;
  if (confirmation.jobId !== job.id || consent.jobId !== job.id) return false;
  if (confirmation.storeId !== job.storeId || consent.storeId !== job.storeId) return false;
  if (confirmation.evidenceRevision !== job.evidenceRevision || consent.evidenceRevision !== job.evidenceRevision) return false;
  if (!consent.channels.includes(channel)) return false;
  if (job.vertical === 'medical') {
    return Boolean(input.medicalVerticalEnabled && input.regulatedReviewApproved);
  }

  return true;
}

export function nextContentCandidateState(input: {
  current: ContentCandidateState;
  action: 'generate' | 'request_review' | 'approve' | 'prepare_publish' | 'publish_receipt' | 'fail';
  publicationEligible: boolean;
}): ContentCandidateState {
  if (input.action === 'fail') return 'FAILED';
  if (input.action === 'generate' && input.current === 'DRAFT') return 'GENERATED';
  if (input.action === 'request_review' && input.current === 'GENERATED') return 'REVIEW_REQUIRED';
  if (input.action === 'approve' && input.current === 'REVIEW_REQUIRED' && input.publicationEligible) return 'APPROVED';
  if (input.action === 'prepare_publish' && input.current === 'APPROVED' && input.publicationEligible) return 'PUBLISH_READY';
  if (input.action === 'publish_receipt' && input.current === 'PUBLISH_READY' && input.publicationEligible) return 'PUBLISHED';
  return input.current;
}

export function createServiceJob(input: {
  id: string;
  storeId: string;
  vertical: ServiceVertical;
  serviceName: string;
  requiresContract?: boolean;
}): ServiceJob {
  const requiresContract = input.requiresContract ?? false;
  const contractState: ContractState = requiresContract ? 'DRAFT' : 'NOT_REQUIRED';
  return {
    ...input,
    requiresContract,
    contractState,
    state: resolveReadyState({ requiresContract, contractState }),
    evidenceRevision: 1,
    paymentState: 'PAYMENT_NOT_REQUESTED',
  };
}
