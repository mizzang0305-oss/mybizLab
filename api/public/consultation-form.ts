import { handlePublicConsultationFormRequest } from '../../src/server/publicApi.js';
import { createPublicRouteHandler } from './_shared.js';

export const config = {
  runtime: 'nodejs',
};

export default createPublicRouteHandler('GET', handlePublicConsultationFormRequest);
