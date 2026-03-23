import { beforeEach, describe, expect, it } from 'vitest';

import { persistDiagnosisSession } from '@/shared/lib/diagnosisSessions';
import { getDatabase, resetDatabase } from '@/shared/lib/mockDb';
import { buildDiagnosisResult, type DiagnosisInput } from '@/shared/lib/onboardingFlow';

describe('diagnosis session persistence', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('stores the latest diagnosis result in the local mock adapter', async () => {
    const diagnosisInput: DiagnosisInput = {
      availableData: ['manual_notes', 'no_feedback'],
      currentConcern: 'unknown_customer_reaction',
      desiredOutcome: 'customer_sentiment',
      industryType: 'korean_buffet',
      region: '서울 마포',
      storeModeSelection: 'not_sure',
    };
    const diagnosisResult = buildDiagnosisResult(diagnosisInput);

    const saved = await persistDiagnosisSession({
      diagnosisInput,
      diagnosisResult,
      visitorKey: 'demo-visitor',
    });

    const database = getDatabase();

    expect(saved?.recommended_store_mode).toBe(diagnosisResult.recommendedStoreMode);
    expect(database.diagnosis_sessions[0]).toMatchObject({
      id: saved?.id,
      recommended_data_mode: diagnosisResult.recommendedDataMode,
      recommended_store_mode: diagnosisResult.recommendedStoreMode,
      visitor_key: 'demo-visitor',
    });
  });
});
