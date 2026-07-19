import { extractSubdomain } from '@saasly/shared';

export const APP_BASE_DOMAIN: string = import.meta.env.VITE_APP_BASE_DOMAIN ?? 'lvh.me';

/** `null` on the default/landing host (`app.<base>` or the bare base domain). */
export function getCurrentSubdomain(): string | null {
  return extractSubdomain(window.location.hostname, APP_BASE_DOMAIN);
}

/**
 * The API resolves the workspace from the request's Host header, so the
 * frontend must call it on the *same hostname* the page is on — just on the API's port — rather
 * than a fixed host. `VITE_API_URL` remains a full override for setups where that doesn't hold
 * (e.g. a single API domain behind a reverse proxy in production).
 */
export function getApiBaseUrl(): string {
  const override = import.meta.env.VITE_API_URL;
  if (override) return override;
  const port = import.meta.env.VITE_API_PORT ?? '4000';
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}
