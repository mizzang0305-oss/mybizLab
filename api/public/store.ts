import { handlePublicStoreRequest } from '../../src/server/publicApi.js';

import { config, createPublicRouteHandler } from './_shared.js';

export { config };

export default createPublicRouteHandler('GET', handlePublicStoreRequest);
