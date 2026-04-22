const PUBLIC_ENV_HINT =
  'Add it to .env.local for local Vite development and to Vercel Project Settings > Environment Variables for Development, Preview, and Production.';

type PublicEnvName = keyof ImportMetaEnv;
type PublicEnvInput = PublicEnvName | readonly PublicEnvName[];

function getImportMetaEnv() {
  try {
    if (typeof import.meta !== 'undefined' && typeof import.meta.env === 'object' && import.meta.env !== null) {
      return import.meta.env as Record<string, unknown>;
    }
  } catch {
    // Some server runtimes transpile import.meta without defining env.
  }

  return undefined;
}

function normalizeNames(input: PublicEnvInput) {
  return Array.isArray(input) ? input : [input];
}

export function readPublicEnv(name: PublicEnvInput) {
  const importMetaEnv = getImportMetaEnv();

  for (const candidate of normalizeNames(name)) {
    const importMetaValue = importMetaEnv?.[candidate];

    if (typeof importMetaValue === 'string' && importMetaValue.trim()) {
      return importMetaValue.trim();
    }

    const processValue =
      typeof process !== 'undefined' && process?.env ? process.env[candidate as keyof NodeJS.ProcessEnv] : undefined;

    if (typeof processValue === 'string' && processValue.trim()) {
      return processValue.trim();
    }
  }

  return undefined;
}

export function readImportMetaBoolean(name: string) {
  const value = getImportMetaEnv()?.[name];

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return false;
}

export function requirePublicEnv(name: PublicEnvInput, usage: string) {
  const value = readPublicEnv(name);

  if (!value) {
    const envNames = normalizeNames(name).join(' or ');
    throw new Error(`Missing required browser env ${envNames} for ${usage}. ${PUBLIC_ENV_HINT}`);
  }

  return value;
}
