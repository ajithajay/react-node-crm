import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { parseServerEnv, type ServerEnv } from '@saasly/shared';

/** Load the repo-root `.env` by walking up from this file (works regardless of cwd). */
function loadEnvFile(): void {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i += 1) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
    dir = dirname(dir);
  }
  dotenv.config();
}

loadEnvFile();

export const env: ServerEnv = parseServerEnv(process.env);
