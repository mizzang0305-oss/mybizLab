import {
  buildDiagnosisPrompt,
  buildDiagnosisResult,
  normalizeDiagnosisResult,
  type DiagnosisInput,
  type DiagnosisModelDraft,
} from '../shared/lib/onboardingFlow';

const AI_DIAGNOSIS_ENDPOINT = '/api/ai/diagnosis';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

class DiagnosisApiError extends Error {
  code: string;
  details?: Record<string, unknown>;
  stage: string;
  status: number;

  constructor(input: {
    code: string;
    details?: Record<string, unknown>;
    message: string;
    stage: string;
    status: number;
  }) {
    super(input.message);
    this.name = 'DiagnosisApiError';
    this.code = input.code;
    this.details = input.details;
    this.stage = input.stage;
    this.status = input.status;
  }
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function responseJson(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

function parseDiagnosisRequest(body: Record<string, unknown>): DiagnosisInput {
  const input: DiagnosisInput = {
    businessType: normalizeString(body.businessType),
    customerType: normalizeString(body.customerType),
    operatingConcerns: normalizeString(body.operatingConcerns),
    region: normalizeString(body.region),
  };

  const missing = Object.entries(input)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new DiagnosisApiError({
      code: 'INVALID_DIAGNOSIS_INPUT',
      details: {
        missingFields: missing,
      },
      message: 'Diagnosis input requires businessType, region, customerType, and operatingConcerns.',
      stage: 'request-body',
      status: 400,
    });
  }

  return input;
}

function readResponseOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (!Array.isArray(payload.output)) {
    return '';
  }

  for (const item of payload.output) {
    if (typeof item !== 'object' || !item) {
      continue;
    }

    const content = (item as Record<string, unknown>).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const contentItem of content) {
      if (typeof contentItem !== 'object' || !contentItem) {
        continue;
      }

      const text = (contentItem as Record<string, unknown>).text;

      if (typeof text === 'string' && text.trim()) {
        return text.trim();
      }
    }
  }

  return '';
}

function createDiagnosisSchema() {
  return {
    additionalProperties: false,
    properties: {
      coreBottlenecks: {
        items: { type: 'string' },
        maxItems: 3,
        minItems: 3,
        type: 'array',
      },
      expansionFeatures: {
        items: { type: 'string' },
        maxItems: 3,
        minItems: 3,
        type: 'array',
      },
      immediateActions: {
        items: { type: 'string' },
        maxItems: 3,
        minItems: 3,
        type: 'array',
      },
      recommendedPlan: {
        enum: ['starter', 'pro', 'business'],
        type: 'string',
      },
      recommendedStrategies: {
        items: { type: 'string' },
        maxItems: 3,
        minItems: 3,
        type: 'array',
      },
      reportSummary: {
        type: 'string',
      },
      revenueOpportunities: {
        items: { type: 'string' },
        maxItems: 3,
        minItems: 3,
        type: 'array',
      },
      score: {
        maximum: 94,
        minimum: 58,
        type: 'number',
      },
      suggestedFeatures: {
        items: {
          enum: [
            'ai_manager',
            'ai_business_report',
            'customer_management',
            'reservation_management',
            'schedule_management',
            'surveys',
            'brand_management',
            'sales_analysis',
            'order_management',
            'waiting_board',
            'contracts',
            'table_order',
          ],
          type: 'string',
        },
        maxItems: 6,
        minItems: 3,
        type: 'array',
      },
      summary: {
        type: 'string',
      },
    },
    required: [
      'score',
      'summary',
      'coreBottlenecks',
      'revenueOpportunities',
      'recommendedStrategies',
      'immediateActions',
      'recommendedPlan',
      'expansionFeatures',
      'reportSummary',
      'suggestedFeatures',
    ],
    type: 'object',
  };
}

async function requestOpenAiDiagnosis(input: DiagnosisInput) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const response = await fetch('https://api.openai.com/v1/responses', {
    body: JSON.stringify({
      input: buildDiagnosisPrompt(input),
      model,
      text: {
        format: {
          name: 'store_diagnosis',
          schema: createDiagnosisSchema(),
          strict: true,
          type: 'json_schema',
        },
      },
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new DiagnosisApiError({
      code: 'OPENAI_DIAGNOSIS_FAILED',
      details: {
        errorText,
        model,
        status: response.status,
      },
      message: 'OpenAI diagnosis request failed.',
      stage: 'openai-request',
      status: 502,
    });
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const outputText = readResponseOutputText(payload);

  if (!outputText) {
    throw new DiagnosisApiError({
      code: 'OPENAI_DIAGNOSIS_FAILED',
      details: {
        model,
        payloadKeys: Object.keys(payload),
      },
      message: 'OpenAI diagnosis response did not contain structured output text.',
      stage: 'openai-parse',
      status: 502,
    });
  }

  try {
    return normalizeDiagnosisResult(JSON.parse(outputText) as DiagnosisModelDraft, input, 'gpt');
  } catch (error) {
    throw new DiagnosisApiError({
      code: 'OPENAI_DIAGNOSIS_FAILED',
      details: {
        errorMessage: error instanceof Error ? error.message : 'Unknown JSON parse failure',
        outputText,
      },
      message: 'OpenAI diagnosis response could not be parsed as structured JSON.',
      stage: 'openai-parse',
      status: 502,
    });
  }
}

async function generateDiagnosis(input: DiagnosisInput) {
  try {
    const gptDiagnosis = await requestOpenAiDiagnosis(input);

    if (gptDiagnosis) {
      return {
        ok: true as const,
        result: gptDiagnosis,
      };
    }
  } catch (error) {
    console.error('[ai-diagnosis] gpt diagnosis failed, falling back to local inference', error);
  }

  return {
    ok: true as const,
    result: buildDiagnosisResult(input, 'fallback'),
  };
}

async function parseRequestBody(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    throw new DiagnosisApiError({
      code: 'INVALID_DIAGNOSIS_INPUT',
      message: `Request body is required for ${AI_DIAGNOSIS_ENDPOINT}`,
      stage: 'request-body',
      status: 400,
    });
  }

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch (error) {
    throw new DiagnosisApiError({
      code: 'INVALID_DIAGNOSIS_INPUT',
      details: {
        parseError: error instanceof Error ? error.message : 'Unknown JSON parse error',
      },
      message: `Failed to parse request body for ${AI_DIAGNOSIS_ENDPOINT}`,
      stage: 'request-body',
      status: 400,
    });
  }
}

export function createDiagnosisMethodNotAllowedResponse() {
  return responseJson(
    {
      code: 'METHOD_NOT_ALLOWED',
      details: {
        allow: ['POST'],
      },
      error: `Only POST is supported on ${AI_DIAGNOSIS_ENDPOINT}`,
      ok: false,
      stage: 'method-check',
    },
    405,
    { allow: 'POST' },
  );
}

export async function handleDiagnosisRequest(request: Request) {
  const body = await parseRequestBody(request);
  const input = parseDiagnosisRequest(body);
  const { result } = await generateDiagnosis(input);

  return responseJson(
    {
      ok: true,
      result,
      source: result.analysisSource,
    },
    200,
  );
}

export function createDiagnosisErrorResponse(error: unknown) {
  if (error instanceof DiagnosisApiError) {
    return responseJson(
      {
        code: error.code,
        details: error.details,
        error: error.message,
        ok: false,
        stage: error.stage,
      },
      error.status,
    );
  }

  console.error('[ai-diagnosis] unexpected failure', error);

  return responseJson(
    {
      code: 'UNEXPECTED_DIAGNOSIS_ERROR',
      details: error instanceof Error ? { name: error.name } : undefined,
      error: error instanceof Error ? error.message : 'Unknown diagnosis error',
      ok: false,
      stage: 'unhandled',
    },
    500,
  );
}
