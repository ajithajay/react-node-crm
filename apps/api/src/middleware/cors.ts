import cors from 'cors';
import { env } from '../lib/config.js';

/** Any `<sub>.<APP_BASE_DOMAIN>` (or the bare base domain) may call the API with credentials. */
function isAllowedOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === env.APP_BASE_DOMAIN || hostname.endsWith(`.${env.APP_BASE_DOMAIN}`);
  } catch {
    return false;
  }
}

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
});
