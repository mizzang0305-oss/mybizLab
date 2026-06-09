import {
  MOCK_LEAD_CAPTURES,
  createLeadCaptureSnapshot,
  transitionLeadStatus,
  type LeadCapture,
  type LeadCaptureStatus,
  type LeadCaptureTransitionPatch,
} from '../../../domain/mybiz/leadCapture';
import { isLaunchGateEnabled } from '../../../shared/lib/launchGates';

import type { LeadCaptureRepository } from './leadCaptureRepository';

function assertOwnerReviewedLeadCaptureEnabled() {
  if (!isLaunchGateEnabled('ownerReviewedLeadCaptureEnabled')) {
    throw new Error('OWNER_REVIEWED_LEAD_CAPTURE_DISABLED');
  }
}

export function createMockLeadCaptureRepository(seed: LeadCapture[] = MOCK_LEAD_CAPTURES): LeadCaptureRepository {
  const leads = new Map(createLeadCaptureSnapshot(seed).map((lead) => [lead.leadId, lead]));

  return {
    mode: 'mock',
    async getLead(leadId: string) {
      assertOwnerReviewedLeadCaptureEnabled();
      const lead = leads.get(leadId);
      return lead ? createLeadCaptureSnapshot([lead])[0] : null;
    },
    async listLeads() {
      assertOwnerReviewedLeadCaptureEnabled();
      return createLeadCaptureSnapshot([...leads.values()]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async transitionLeadStatus(leadId: string, status: LeadCaptureStatus, patch: LeadCaptureTransitionPatch = {}) {
      assertOwnerReviewedLeadCaptureEnabled();
      const lead = leads.get(leadId);
      if (!lead) {
        throw new Error('LEAD_CAPTURE_NOT_FOUND');
      }

      const nextLead = transitionLeadStatus(lead, status, patch);
      leads.set(leadId, nextLead);

      return {
        code: 'MOCK_LEAD_STATUS_UPDATED',
        lead: createLeadCaptureSnapshot([nextLead])[0],
        mode: 'mock',
        ok: true,
      };
    },
  };
}
