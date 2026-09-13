import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MEDICAL_VERTICAL_ENABLED,
  VERTICAL_TEMPLATES,
  canStartWork,
  createServiceJob,
  isPublicationEligible,
  isSameTenant,
  nextContentCandidateState,
  resolveJobStateAfterRevision,
  validateConfirmationLink,
  type ConsentRecord,
  type CustomerConfirmation,
  type ServiceJob,
} from '@/domain/mybiz/serviceOs';

const baseJob = (overrides: Partial<ServiceJob> = {}): ServiceJob => ({
  ...createServiceJob({ id: 'job-1', storeId: 'store-a', vertical: 'cleaning', serviceName: '입주청소' }),
  state: 'WORK_COMPLETED',
  ...overrides,
});

const confirmation: CustomerConfirmation = {
  id: 'confirmation-1',
  storeId: 'store-a',
  jobId: 'job-1',
  evidenceRevision: 1,
  outcome: 'confirmed',
  confirmedAt: '2026-09-13T00:00:00.000Z',
};

const consent: ConsentRecord = {
  id: 'consent-1',
  storeId: 'store-a',
  jobId: 'job-1',
  evidenceRevision: 1,
  purpose: 'marketing',
  textVersion: 'marketing-v1',
  channels: ['website'],
  grantedAt: '2026-09-13T00:00:00.000Z',
  actor: 'customer',
  source: 'secure_link',
};

describe('MyBiz Service OS product policy', () => {
  it('defaults contract to optional and lets a job start without it', () => {
    const job = createServiceJob({ id: 'job-1', storeId: 'store-a', vertical: 'cleaning', serviceName: '입주청소' });
    expect(job.requiresContract).toBe(false);
    expect(job.contractState).toBe('NOT_REQUIRED');
    expect(job.state).toBe('WORK_READY');
    expect(canStartWork(job)).toBe(true);
  });

  it('blocks a required contract until accepted or signed', () => {
    const job = createServiceJob({ id: 'job-1', storeId: 'store-a', vertical: 'installation', serviceName: '에어컨 설치', requiresContract: true });
    expect(job.state).toBe('CONTRACT_REQUIRED');
    expect(canStartWork(job)).toBe(false);
    expect(canStartWork({ ...job, contractState: 'ACCEPTED' })).toBe(true);
    expect(canStartWork({ ...job, contractState: 'SIGNED' })).toBe(true);
  });

  it('keeps customer confirmation separate from payment', () => {
    const job = baseJob({ state: 'CUSTOMER_CONFIRMED' });
    expect(job.paymentState).toBe('PAYMENT_NOT_REQUESTED');
  });

  it('does not require marketing consent to confirm a job', () => {
    expect(confirmation.outcome).toBe('confirmed');
    expect(isPublicationEligible({ job: baseJob(), confirmation, merchantApproved: true, channel: 'website' })).toBe(false);
  });

  it('does not treat marketing consent as job confirmation', () => {
    expect(isPublicationEligible({ job: baseJob(), consent, merchantApproved: true, channel: 'website' })).toBe(false);
  });

  it('makes withdrawn consent ineligible for future publication', () => {
    expect(isPublicationEligible({ job: baseJob(), confirmation, consent: { ...consent, withdrawnAt: '2026-09-13T01:00:00.000Z' }, merchantApproved: true, channel: 'website' })).toBe(false);
  });

  it('preserves previous confirmation evidence when a revision changes', () => {
    const next = resolveJobStateAfterRevision(baseJob(), [confirmation]);
    expect(next.evidenceRevision).toBe(2);
    expect(next.state).toBe('CONFIRMATION_OUTDATED');
    expect(confirmation.evidenceRevision).toBe(1);
  });

  it('denies cross-tenant access', () => {
    expect(isSameTenant('store-a', 'store-a')).toBe(true);
    expect(isSameTenant('store-a', 'store-b')).toBe(false);
    expect(isSameTenant('', '')).toBe(false);
  });

  it('denies invalid, expired, revoked and wrong-revision confirmation links', () => {
    const link = {
      jobId: 'job-1',
      evidenceRevision: 1,
      expectedJobId: 'job-1',
      expectedEvidenceRevision: 1,
      tokenHashMatches: true,
      expiresAt: '2026-09-14T00:00:00.000Z',
      now: '2026-09-13T00:00:00.000Z',
    };
    expect(validateConfirmationLink(link)).toBe(true);
    expect(validateConfirmationLink({ ...link, tokenHashMatches: false })).toBe(false);
    expect(validateConfirmationLink({ ...link, now: link.expiresAt })).toBe(false);
    expect(validateConfirmationLink({ ...link, now: 'not-a-date' })).toBe(false);
    expect(validateConfirmationLink({ ...link, expiresAt: 'not-a-date' })).toBe(false);
    expect(validateConfirmationLink({ ...link, revokedAt: '2026-09-13T00:00:00.000Z' })).toBe(false);
    expect(validateConfirmationLink({ ...link, evidenceRevision: 2 })).toBe(false);
  });

  it('denies medical publication by default', () => {
    expect(DEFAULT_MEDICAL_VERTICAL_ENABLED).toBe(false);
    expect(isPublicationEligible({ job: baseJob({ vertical: 'medical' }), confirmation, consent, merchantApproved: true, channel: 'website' })).toBe(false);
  });

  it('requires both the medical feature and regulated review for medical publication', () => {
    const input = { job: baseJob({ vertical: 'medical' as const }), confirmation, consent, merchantApproved: true, channel: 'website' as const };
    expect(isPublicationEligible({ ...input, medicalVerticalEnabled: true })).toBe(false);
    expect(isPublicationEligible({ ...input, medicalVerticalEnabled: true, regulatedReviewApproved: true })).toBe(true);
  });

  it('requires merchant approval and exact channel consent', () => {
    expect(isPublicationEligible({ job: baseJob(), confirmation, consent, merchantApproved: false, channel: 'website' })).toBe(false);
    expect(isPublicationEligible({ job: baseJob(), confirmation, consent, merchantApproved: true, channel: 'blog' })).toBe(false);
    expect(isPublicationEligible({ job: baseJob(), confirmation, consent, merchantApproved: true, channel: 'website' })).toBe(true);
  });

  it('stops the content pipeline at review until publication policy passes', () => {
    expect(nextContentCandidateState({ current: 'DRAFT', action: 'generate', publicationEligible: false })).toBe('GENERATED');
    expect(nextContentCandidateState({ current: 'GENERATED', action: 'request_review', publicationEligible: false })).toBe('REVIEW_REQUIRED');
    expect(nextContentCandidateState({ current: 'REVIEW_REQUIRED', action: 'approve', publicationEligible: false })).toBe('REVIEW_REQUIRED');
    expect(nextContentCandidateState({ current: 'REVIEW_REQUIRED', action: 'approve', publicationEligible: true })).toBe('APPROVED');
  });

  it('never reports published without a provider receipt transition', () => {
    expect(nextContentCandidateState({ current: 'APPROVED', action: 'prepare_publish', publicationEligible: true })).toBe('PUBLISH_READY');
    expect(nextContentCandidateState({ current: 'PUBLISH_READY', action: 'prepare_publish', publicationEligible: true })).toBe('PUBLISH_READY');
    expect(nextContentCandidateState({ current: 'PUBLISH_READY', action: 'publish_receipt', publicationEligible: true })).toBe('PUBLISHED');
  });

  it('keeps the public V1 verticals limited to cleaning, hair and installation', () => {
    expect(VERTICAL_TEMPLATES.filter((template) => template.publicV1).map((template) => template.id)).toEqual(['cleaning', 'hair', 'installation']);
  });
});
