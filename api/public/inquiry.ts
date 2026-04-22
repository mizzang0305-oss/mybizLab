import { handlePublicInquiryRequest } from '../../src/server/publicApi.js';

import { config, createPublicRouteHandler } from './_shared.js';

export { config };

export default createPublicRouteHandler('POST', handlePublicInquiryRequest);
