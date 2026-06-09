import { isLaunchGateEnabled } from '../../../shared/lib/launchGates';

import {
  LIVE_LEAD_WRITE_DISABLED_RESULT,
  type DisabledSupabaseLeadCaptureRepository,
} from './leadCaptureRepository';

export function createDisabledSupabaseLeadCaptureRepository(): DisabledSupabaseLeadCaptureRepository {
  return {
    mode: 'supabase-disabled',
    async writeLead() {
      void isLaunchGateEnabled('broadDbWriteEnabled');
      return LIVE_LEAD_WRITE_DISABLED_RESULT;
    },
  };
}
