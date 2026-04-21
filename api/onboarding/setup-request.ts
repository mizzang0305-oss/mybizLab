import { sendNodeResponse, type NodeResponseLike } from '../../src/server/nodeResponse.js';

export const config = {
  runtime: 'nodejs',
};

type RequestLike =
  | Request
  | {
      body?: unknown;
      headers?: Headers | Record<string, string | string[] | undefined>;
      method?: string;
      rawBody?: unknown;
      text?: () => Promise<string>;
      url?: string;
    };

export default async function handler(request: RequestLike, response?: NodeResponseLike) {
  let result: Response;

  if ((request.method || 'GET').toUpperCase() !== 'POST') {
    result = Response.json(
      {
        ok: false,
        code: 'METHOD_NOT_ALLOWED',
        error: 'Only POST is supported on /api/onboarding/setup-request',
      },
      {
        status: 405,
        headers: {
          allow: 'POST',
        },
      },
    );
  } else {
    try {
      const { handleOnboardingSetupRequest } = await import('../../src/server/onboardingSetupRequest.js');
      result = await handleOnboardingSetupRequest(request);
    } catch (error) {
      result = Response.json(
        {
          ok: false,
          code: 'ONBOARDING_SETUP_REQUEST_INIT_FAILED',
          error: error instanceof Error ? error.message : 'Unknown onboarding setup request initialization error',
        },
        {
          status: 500,
        },
      );
    }
  }

  await sendNodeResponse(result, response);
  return result;
}
