const PUBLIC_ENV_HINT =
  'Add it to .env.local for local Vite development and to Vercel Project Settings > Environment Variables for Development, Preview, and Production.';

type PublicEnvName = keyof ImportMetaEnv;
type PublicEnvInput = PublicEnvName | readonly PublicEnvName[];

function normalizeNames(input: PublicEnvInput) {
  return Array.isArray(input) ? input : [input];
}

export function readPublicEnv(name: PublicEnvInput) {
  for (const candidate of normalizeNames(name)) {
    const value = import.meta.env[candidate];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

export function requirePublicEnv(name: PublicEnvInput, usage: string) {
  const value = readPublicEnv(name);

  if (!value) {
    const envNames = normalizeNames(name).join(' or ');
    throw new Error(`Missing required browser env ${envNames} for ${usage}. ${PUBLIC_ENV_HINT}`);
  }

  return value;
}