import {
  buildDiagnosisResult,
  type DiagnosisInput,
  type DiagnosisResult,
} from '@/shared/lib/onboardingFlow';

const DIAGNOSIS_ENDPOINT = '/api/ai/diagnosis';
const MIN_DIAGNOSIS_DURATION_MS = 3400;

interface DiagnosisApiSuccessResponse {
  ok: true;
  result: DiagnosisResult;
  source: DiagnosisResult['analysisSource'];
}

function waitForMinimumDuration(startedAt: number) {
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, MIN_DIAGNOSIS_DURATION_MS - elapsed);

  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, remaining);
  });
}

export async function requestStructuredDiagnosis(input: DiagnosisInput) {
  const startedAt = Date.now();

  try {
    const response = await fetch(DIAGNOSIS_ENDPOINT, {
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Diagnosis request failed with ${response.status}`);
    }

    const payload = (await response.json()) as DiagnosisApiSuccessResponse;

    if (!payload.ok || !payload.result) {
      throw new Error('Diagnosis API returned an invalid payload');
    }

    await waitForMinimumDuration(startedAt);
    return payload.result;
  } catch (error) {
    console.info('[diagnosis-client] falling back to local diagnosis inference', error);
    await waitForMinimumDuration(startedAt);
    return buildDiagnosisResult(input, 'fallback');
  }
}
