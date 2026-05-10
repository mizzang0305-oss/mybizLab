import { describe, expect, it } from 'vitest';

import vercelConfig from '../../vercel.json';

describe('vercel public API rewrites', () => {
  it('routes public order customer mutations through the single public function', () => {
    const route = vercelConfig.routes.find(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        'src' in entry &&
        entry.src === '/api/public/order-customer',
    );

    expect(route).toMatchObject({
      dest: '/api/public?resource=order-customer',
      src: '/api/public/order-customer',
    });
  });

  it('routes YouTube OAuth foundation endpoints through the existing merchant function', () => {
    expect(vercelConfig.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dest: '/api/merchant?resource=youtube-oauth-start',
          src: '/api/social/youtube/oauth/start',
        }),
        expect.objectContaining({
          dest: '/api/merchant?resource=youtube-oauth-callback',
          src: '/api/social/youtube/oauth/callback',
        }),
      ]),
    );
  });
});
