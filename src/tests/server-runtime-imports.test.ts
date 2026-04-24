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
});
