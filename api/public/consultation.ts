import { handlePublicConsultationRequest } from '../../src/server/publicApi.js';
import { createPublicRouteHandler } from './_shared.js';

export const config = {
  runtime: 'nodejs',
};

export default createPublicRouteHandler('POST', handlePublicConsultationRequest);
