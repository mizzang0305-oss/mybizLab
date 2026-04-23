import { PUBLIC_SERVICE_ORIGIN } from './appConfig.js';

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

export function resolveServerApiUrl(path: string) {
  const normalizedPath = normalizePath(path);

  if (typeof window === 'undefined') {
    return new URL(normalizedPath, PUBLIC_SERVICE_ORIGIN).toString();
  }

  const configuredOrigin = PUBLIC_SERVICE_ORIGIN?.trim();
  if (!configuredOrigin) {
    return normalizedPath;
  }

  try {
    const configuredUrl = new URL(configuredOrigin);
    const currentUrl = new URL(window.location.origin);

    if (
      isLocalHostname(configuredUrl.hostname) &&
      isLocalHostname(currentUrl.hostname) &&
      configuredUrl.origin !== currentUrl.origin
    ) {
      return new URL(normalizedPath, configuredUrl.origin).toString();
    }
  } catch {
    return normalizedPath;
  }

  return normalizedPath;
}
