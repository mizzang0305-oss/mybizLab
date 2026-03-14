const PUBLIC_ENV_HINT =
  'Add it to .env.local for local Vite development and to Vercel Project Settings > Environment Variables for Development, Preview, and Production.';

type PublicEnvName = keyof ImportMetaEnv;

export function readPublicEnv(name: PublicEnvName) {
  const value = import.meta.env[name];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function requirePublicEnv(name: PublicEnvName, usage: string) {
  const value = readPublicEnv(name);

  if (!value) {
    throw new Error(`Missing required browser env ${name} for ${usage}. ${PUBLIC_ENV_HINT}`);
  }

  return value;
}
