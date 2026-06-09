import type { LeadCapture, LeadCaptureStatus, LeadCaptureTransitionPatch } from '../../../domain/mybiz/leadCapture';

export type LeadCaptureRepositoryMode = 'mock' | 'supabase-disabled';

export interface LeadCaptureWriteBlockedResult {
  approvalRequired: true;
  code: 'LIVE_LEAD_WRITE_DISABLED';
  ok: false;
}

export interface LeadCaptureTransitionResult {
  code: 'MOCK_LEAD_STATUS_UPDATED';
  lead: LeadCapture;
  mode: LeadCaptureRepositoryMode;
  ok: true;
}

export interface LeadCaptureRepository {
  mode: LeadCaptureRepositoryMode;
  getLead: (leadId: string) => Promise<LeadCapture | null>;
  listLeads: () => Promise<LeadCapture[]>;
  transitionLeadStatus: (
    leadId: string,
    status: LeadCaptureStatus,
    patch?: LeadCaptureTransitionPatch,
  ) => Promise<LeadCaptureTransitionResult | LeadCaptureWriteBlockedResult>;
}

export interface DisabledSupabaseLeadCaptureRepository {
  mode: 'supabase-disabled';
  writeLead: () => Promise<LeadCaptureWriteBlockedResult>;
}

export const LIVE_LEAD_WRITE_DISABLED_RESULT: LeadCaptureWriteBlockedResult = {
  approvalRequired: true,
  code: 'LIVE_LEAD_WRITE_DISABLED',
  ok: false,
};
