import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const runtimeFiles = [
  join(process.cwd(), 'api', 'public.ts'),
  join(process.cwd(), 'api', 'auth', 'session.ts'),
  join(process.cwd(), 'src', 'server', 'publicApi.ts'),
  join(process.cwd(), 'src', 'server', 'billingWebhook.ts'),
  join(process.cwd(), 'src', 'integrations', 'supabase', 'client.ts'),
  join(process.cwd(), 'src', 'integrations', 'firebase', 'client.ts'),
];

describe('server runtime imports', () => {
  it('does not use tsconfig path aliases in server-executed entry points', () => {
    for (const filePath of runtimeFiles) {
      const source = readFileSync(filePath, 'utf8');
      expect(source, filePath).not.toMatch(/from ['"]@\//);
      expect(source, filePath).not.toMatch(/import ['"]@\//);
    }
  });
});
