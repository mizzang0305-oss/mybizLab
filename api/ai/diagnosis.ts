import {
  createDiagnosisErrorResponse,
  createDiagnosisMethodNotAllowedResponse,
  handleDiagnosisRequest,
} from '../../src/server/aiDiagnosis';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  try {
    if (request.method !== 'POST') {
      return createDiagnosisMethodNotAllowedResponse();
    }

    return await handleDiagnosisRequest(request);
  } catch (error) {
    return createDiagnosisErrorResponse(error);
  }
}
