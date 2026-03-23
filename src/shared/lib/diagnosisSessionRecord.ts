import type { SaveDiagnosisSessionInput } from '@/shared/lib/data/contracts';
import { diagnosisSessionDocumentSchema } from '@/shared/lib/diagnosisSchema';
import type { DiagnosisSession } from '@/shared/types/models';

function createDiagnosisSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `diagnosis_${crypto.randomUUID()}`;
  }

  return `diagnosis_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function buildDiagnosisSessionRecord(input: SaveDiagnosisSessionInput, existingId?: string): DiagnosisSession {
  const now = new Date().toISOString();

  return diagnosisSessionDocumentSchema.parse({
    analysis_source: input.diagnosisResult.analysisSource,
    available_data: input.diagnosisInput.availableData,
    completed: true,
    created_at: now,
    current_concern: input.diagnosisInput.currentConcern,
    desired_outcome: input.diagnosisInput.desiredOutcome,
    id: existingId || createDiagnosisSessionId(),
    industry_type: input.diagnosisInput.industryType,
    recommended_data_mode: input.diagnosisResult.recommendedDataMode,
    recommended_modules: input.diagnosisResult.recommendedModules,
    recommended_questions: input.diagnosisResult.recommendedQuestions,
    recommended_store_mode: input.diagnosisResult.recommendedStoreMode,
    region: input.diagnosisInput.region.trim(),
    store_mode_selection: input.diagnosisInput.storeModeSelection,
    updated_at: now,
    visitor_key: input.visitorKey?.trim() || undefined,
  });
}
