import { z } from 'zod';

/**
 * Server-side environment contract. Shared so api and worker validate identically.
 * NOTE: this module reads no globals — the caller passes the source (e.g. `process.env`),
 * so it stays safe to import from any package (including the browser bundle).
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  APP_BASE_DOMAIN: z.string().default('lvh.me'),
  FRONTEND_URL: z.string().default('http://app.lvh.me:3000'),

  // --- Auth (Phase 3) ---
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),
  LOGIN_TOKEN_TTL: z.string().default('2m'),
  WORKSPACE_AGNOSTIC_TOKEN_TTL: z.string().default('10m'),
  EMAIL_VERIFICATION_TOKEN_TTL: z.string().default('24h'),
  PASSWORD_RESET_TOKEN_TTL: z.string().default('1h'),
  TWO_FACTOR_CHALLENGE_TOKEN_TTL: z.string().default('5m'),

  // --- Email (Phase 3) ---
  EMAIL_DRIVER: z.enum(['smtp', 'log']).default('log'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('Saasly CRM <no-reply@saasly.local>'),

  // --- File storage (Phase 5a) ---
  STORAGE_TYPE: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('./.storage'),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),

  // --- Webhooks ---
  // Blocks loopback/link-local/private-range targets by default (SSRF guard); set to 'true' only
  // for local dev testing against a receiver on localhost/private network.
  WEBHOOK_ALLOW_PRIVATE_TARGETS: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  WEBHOOK_RETRY_BACKOFF_MS: z.coerce.number().int().positive().default(5000),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Parse + validate server env. Throws with a readable message listing every problem. */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid server environment:\n${issues}`);
  }
  return result.data;
}
