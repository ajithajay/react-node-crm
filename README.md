# Saasly CRM

Subdomain-based, multi-tenant CRM. Turborepo + pnpm monorepo.

> **Docs / source of truth** live one level up in [`../docs/`](../docs).

## Getting started

```bash
nvm use                 # Node 24
pnpm install
docker compose -f docker/docker-compose.yml up -d   # local infra (added in Phase 1)
pnpm dev                # runs web + api + worker
```

## Workspace

- `apps/web` — React + Vite frontend
- `apps/api` — Express REST API
- `apps/worker` — BullMQ background worker
- `packages/shared` — zod schemas, types, enums, utils
- `packages/database` — TypeORM datasources, entities, metadata→DDL engine
- `packages/emails` — React Email templates
- `packages/config` — shared tsconfig / eslint / prettier presets

**Rule:** never hand-pin dependency versions. Add deps via `pnpm --filter <pkg> add <dep>`.
