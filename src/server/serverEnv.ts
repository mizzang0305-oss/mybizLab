const SERVER_ENV_HINT =
  'Add it to .env.local when using vercel dev, and to Vercel Project Settings > Environment Variables for Development, Preview, and Production.';

export function readServerEnv(name: string) {
  const value = process.env[name];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function requireServerEnv(name: string, usage: string) {
  const value = readServerEnv(name);

  if (!value) {
    throw new Error(`Missing required server env ${name} for ${usage}. ${SERVER_ENV_HINT}`);
  }

  return value;
}
