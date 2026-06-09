import {
  resolveLeadCaptureWriteGate,
  type DisabledSupabaseLeadCaptureRepository,
} from './leadCaptureRepository';

export function createDisabledSupabaseLeadCaptureRepository(): DisabledSupabaseLeadCaptureRepository {
  return {
    mode: 'supabase-disabled',
    async writeLead() {
      return resolveLeadCaptureWriteGate() ?? {
        approvalRequired: true,
        code: 'LIVE_LEAD_WRITE_DISABLED',
        gate: 'liveLeadWriteEnabled',
        ok: false,
      };
    },
  };
}
