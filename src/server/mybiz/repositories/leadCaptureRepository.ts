import type {
  LeadCapture,
  LeadCaptureDataReadiness,
  LeadCaptureSource,
  LeadCaptureStatus,
  LeadCaptureTransitionPatch,
} from '../../../domain/mybiz/leadCapture';
import type { LaunchGateKey } from '../../../shared/lib/launchGates';

import { isLaunchGateEnabled } from '../../../shared/lib/launchGates';

export type LeadCaptureRepositoryMode = 'mock' | 'supabase-disabled' | 'supabase';
export type LeadCaptureWriteGateKey =
  | 'broadDbWriteEnabled'
  | 'leadCapturePersistenceEnabled'
  | 'liveLeadWriteEnabled';

export interface LeadCaptureWriteBlockedResult {
  approvalRequired: true;
  code: 'LIVE_LEAD_WRITE_DISABLED';
  gate: LeadCaptureWriteGateKey;
  ok: false;
}

export interface LeadCaptureWriteSuccessResult {
  code: 'LIVE_LEAD_CAPTURE_WRITTEN';
  leadId: string;
  mode: 'supabase';
  ok: true;
}

export type LeadCaptureWriteResult = LeadCaptureWriteBlockedResult | LeadCaptureWriteSuccessResult;

export interface LeadCaptureWriteDraft {
  addressSummary?: string;
  businessType: string;
  consentContact?: boolean;
  consentMarketing?: boolean;
  contactEmailEncrypted?: string | null;
  contactEmailMasked?: string | null;
  contactName?: string;
  contactPhoneEncrypted?: string | null;
  contactPhoneMasked?: string | null;
  currentCustomerManagement?: string;
  currentInquiryFlow?: string;
  currentReservationFlow?: string;
  dataReadiness: LeadCaptureDataReadiness;
  desiredOutcome: string;
  mainConcern: string;
  memorySeedSummary?: string;
  nextAction?: string;
  ownerNote?: string;
  ownerProfileId?: string | null;
  pilotFitScore?: number | null;
  source: LeadCaptureSource;
  status?: LeadCaptureStatus;
  storeId?: string | null;
  storeName: string;
}

export interface LeadCaptureWriteApproval {
  broadDbWriteEnabled?: boolean;
  leadCapturePersistenceEnabled?: boolean;
  liveLeadWriteEnabled?: boolean;
}

export interface SupabaseLeadCaptureClient {
  from: (table: 'lead_capture_requests') => {
    insert: (row: Record<string, unknown>) => {
      select: (columns: 'id') => {
        single: () => Promise<{
          data: { id: string } | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
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

export function resolveLeadCaptureWriteGate(
  approval: LeadCaptureWriteApproval = {},
): LeadCaptureWriteBlockedResult | null {
  const gateOrder: LeadCaptureWriteGateKey[] = [
    'broadDbWriteEnabled',
    'leadCapturePersistenceEnabled',
    'liveLeadWriteEnabled',
  ];

  for (const gate of gateOrder) {
    const enabled = approval[gate] ?? isLaunchGateEnabled(gate as LaunchGateKey);
    if (!enabled) {
      return {
        approvalRequired: true,
        code: 'LIVE_LEAD_WRITE_DISABLED',
        gate,
        ok: false,
      };
    }
  }

  return null;
}

export const LIVE_LEAD_WRITE_DISABLED_RESULT: LeadCaptureWriteBlockedResult = {
  approvalRequired: true,
  code: 'LIVE_LEAD_WRITE_DISABLED',
  gate: 'broadDbWriteEnabled',
  ok: false,
};
