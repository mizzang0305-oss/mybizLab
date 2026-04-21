import { handleOnboardingSetupRequest } from '../../src/server/onboardingSetupRequest.js';
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
  const result = await handleOnboardingSetupRequest(request);
  await sendNodeResponse(result, response);
  return result;
}
