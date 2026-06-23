import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function listRuntimeSourceFiles(rootPath: string): string[] {
  const entries = readdirSync(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...listRuntimeSourceFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

const runtimeRoots = [
  join(process.cwd(), 'api'),
  join(process.cwd(), 'src', 'server'),
  join(process.cwd(), 'src', 'integrations'),
  join(process.cwd(), 'src', 'shared', 'lib'),
];

const runtimeFiles = runtimeRoots
  .filter((rootPath) => statSync(rootPath).isDirectory())
  .flatMap((rootPath) => listRuntimeSourceFiles(rootPath));

describe('server runtime imports', () => {
  it('does not use tsconfig path aliases in server-executed source files', () => {
    for (const filePath of runtimeFiles) {
      const source = readFileSync(filePath, 'utf8');
      expect(source, filePath).not.toMatch(/from ['"]@\//);
      expect(source, filePath).not.toMatch(/import ['"]@\//);
    }
  });

  it('keeps public SEO routes isolated from MyBiz service runtime imports at module load', () => {
    const source = readFileSync(join(process.cwd(), 'api', 'public.ts'), 'utf8');
    const moduleHeader = source.slice(0, source.indexOf('async function routePublicRequest'));

    expect(moduleHeader).not.toContain('customerMemoryApi');
    expect(moduleHeader).not.toContain('publicPageEventService');
    expect(source).toMatch(/await import\(\s*['"]\.\.\/src\/server\/mybiz\/services\/customerMemoryApi\.js['"]\s*\)/);
    expect(source).toMatch(
      /await import\(\s*['"]\.\.\/src\/server\/mybiz\/services\/publicPageEventService\.js['"]\s*\)/,
    );
  });

  it('uses explicit js extensions for customer-memory server runtime imports', () => {
    const files = [
      join(process.cwd(), 'src', 'server', 'mybiz', 'services', 'customerMemoryApi.ts'),
      join(process.cwd(), 'src', 'server', 'mybiz', 'services', 'publicPageEventService.ts'),
      join(process.cwd(), 'src', 'server', 'mybiz', 'repositories', 'customerRepository.ts'),
      join(process.cwd(), 'src', 'server', 'mybiz', 'repositories', 'leadCaptureRepository.ts'),
      join(process.cwd(), 'src', 'server', 'mybiz', 'repositories', 'mockLeadCaptureRepository.ts'),
    ];

    for (const filePath of files) {
      const source = readFileSync(filePath, 'utf8');
      const extensionlessImports =
        source.match(
          /from ['"][^'"]*(launchGates|supabaseRepository|nodeResponse|supabaseAdmin|customerRepository|customerMemoryProductionAdapter|customerMemoryIntakeService)['"]/g,
        ) ?? [];

      expect(extensionlessImports, filePath).toEqual([]);
    }
  });

  it('keeps server-loaded billing plan imports resolvable in Vercel Node runtime', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'shared', 'lib', 'billingPlans.ts'), 'utf8');

    expect(source).toContain("from './platformAdminConfig.js'");
    expect(source).not.toContain("from './platformAdminConfig'");
  });
});
