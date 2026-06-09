import {
  resolveLeadCaptureWriteGate,
  type LeadCaptureWriteApproval,
  type LeadCaptureWriteDraft,
  type LeadCaptureWriteResult,
  type SupabaseLeadCaptureClient,
} from './leadCaptureRepository';

interface SupabaseLeadCaptureRepositoryOptions {
  approval?: LeadCaptureWriteApproval;
  client?: SupabaseLeadCaptureClient;
}

function nullableText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toLeadCaptureRequestRow(draft: LeadCaptureWriteDraft) {
  return {
    address_summary: nullableText(draft.addressSummary),
    business_type: draft.businessType.trim(),
    consent_contact: draft.consentContact === true,
    consent_marketing: draft.consentMarketing === true,
    contact_email_encrypted: nullableText(draft.contactEmailEncrypted),
    contact_email_masked: nullableText(draft.contactEmailMasked),
    contact_name: nullableText(draft.contactName),
    contact_phone_encrypted: nullableText(draft.contactPhoneEncrypted),
    contact_phone_masked: nullableText(draft.contactPhoneMasked),
    current_customer_management: nullableText(draft.currentCustomerManagement),
    current_inquiry_flow: nullableText(draft.currentInquiryFlow),
    current_reservation_flow: nullableText(draft.currentReservationFlow),
    data_readiness: draft.dataReadiness,
    desired_outcome: draft.desiredOutcome.trim(),
    main_concern: draft.mainConcern.trim(),
    memory_seed_summary: nullableText(draft.memorySeedSummary),
    next_action: nullableText(draft.nextAction),
    owner_note: nullableText(draft.ownerNote),
    owner_profile_id: draft.ownerProfileId ?? null,
    pilot_fit_score: draft.pilotFitScore ?? null,
    source: draft.source,
    status: draft.status ?? 'new',
    store_id: draft.storeId ?? null,
    store_name: draft.storeName.trim(),
  };
}

export function createSupabaseLeadCaptureRepository(options: SupabaseLeadCaptureRepositoryOptions = {}) {
  return {
    mode: 'supabase' as const,
    async writeLead(draft: LeadCaptureWriteDraft): Promise<LeadCaptureWriteResult> {
      const blocked = resolveLeadCaptureWriteGate(options.approval);
      if (blocked) return blocked;

      if (!options.client) {
        throw new Error('SUPABASE_LEAD_CAPTURE_CLIENT_REQUIRED');
      }

      const { data, error } = await options.client
        .from('lead_capture_requests')
        .insert(toLeadCaptureRequestRow(draft))
        .select('id')
        .single();

      if (error || !data?.id) {
        throw new Error(error?.message || 'SUPABASE_LEAD_CAPTURE_WRITE_FAILED');
      }

      return {
        code: 'LIVE_LEAD_CAPTURE_WRITTEN',
        leadId: data.id,
        mode: 'supabase',
        ok: true,
      };
    },
  };
}
