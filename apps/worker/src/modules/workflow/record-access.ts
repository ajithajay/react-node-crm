import { FieldMetadataEntity, ObjectMetadataEntity } from '@saasly/database';
import {
  evaluateConditions,
  resolveInput,
  FieldMetadataType,
  type StepFilter,
  type StepFilterGroup,
} from '@saasly/shared';
import { dataSource, workspaceDataSourceCache } from '../../lib/db.js';
import { decodeRecord, encodeRecordInput } from './record-codec.js';

/**
 * System-authority record CRUD for workflow actions. Uses the workspace datasource + dynamic entity
 * (no permission checks — workflows run as the system) and does NOT cascade downstream webhooks /
 * timeline / other workflows' record-event triggers (a deliberate v1 choice: avoids recursive
 * trigger loops; documented in task-list.md).
 */

async function resolveObject(workspaceId: string, objectName: string): Promise<ObjectMetadataEntity> {
  const repo = dataSource.getRepository(ObjectMetadataEntity);
  // Accept either singular or plural name for resilience against how the builder stored it.
  const object =
    (await repo.findOneBy({ workspaceId, nameSingular: objectName })) ??
    (await repo.findOneBy({ workspaceId, namePlural: objectName }));
  if (!object) throw new Error(`Object "${objectName}" not found`);
  return object;
}

async function activeFields(workspaceId: string, objectId: string): Promise<FieldMetadataEntity[]> {
  return dataSource
    .getRepository(FieldMetadataEntity)
    .findBy({ workspaceId, objectMetadataId: objectId, isActive: true });
}

async function repoFor(workspaceId: string, object: ObjectMetadataEntity) {
  const ws = await workspaceDataSourceCache.getWorkspaceDataSource(workspaceId);
  return ws.getRepository(object.nameSingular);
}

/** Coerce string inputs from the builder into the right JS type for scalar columns. */
function coerce(fields: FieldMetadataEntity[], body: Record<string, unknown>): Record<string, unknown> {
  const byCamel = new Map(fields.map((f) => [toCamel(f.name), f]));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    const field = byCamel.get(key);
    if (field && typeof value === 'string') {
      if (field.type === FieldMetadataType.NUMBER || field.type === FieldMetadataType.RATING) {
        out[key] = value === '' ? null : Number(value);
        continue;
      }
      if (field.type === FieldMetadataType.BOOLEAN) {
        out[key] = value === 'true' || value === '1';
        continue;
      }
    }
    out[key] = value;
  }
  return out;
}

function toCamel(name: string): string {
  return name.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export async function createRecord(
  workspaceId: string,
  objectName: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const object = await resolveObject(workspaceId, objectName);
  const fields = await activeFields(workspaceId, object.id);
  const data = encodeRecordInput(fields, coerce(fields, body));
  const repo = await repoFor(workspaceId, object);
  const saved = await repo.save(repo.create(data));
  return decodeRecord(fields, saved as Record<string, unknown>);
}

export async function updateRecord(
  workspaceId: string,
  objectName: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const object = await resolveObject(workspaceId, objectName);
  const fields = await activeFields(workspaceId, object.id);
  const repo = await repoFor(workspaceId, object);
  const existing = await repo.findOneBy({ id });
  if (!existing) throw new Error(`Record ${id} not found`);
  const data = encodeRecordInput(fields, coerce(fields, body));
  const saved = await repo.save(repo.merge(existing, data));
  return decodeRecord(fields, saved as Record<string, unknown>);
}

/**
 * `uniqueField` is the entity property to match on (an object's `id`, or any TEXT field the builder's
 * "Unique field" select offers) — NOT necessarily "id". Previously this always matched by `id` no
 * matter what the user picked, silently ignoring `uniqueField` and creating a duplicate every run.
 */
export async function upsertRecord(
  workspaceId: string,
  objectName: string,
  uniqueField: string,
  matchValue: string | undefined,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (matchValue) {
    const object = await resolveObject(workspaceId, objectName);
    const repo = await repoFor(workspaceId, object);
    const existing = await repo.findOneBy({ [uniqueField || 'id']: matchValue } as Record<string, unknown>);
    if (existing) {
      const existingId = (existing as Record<string, unknown>).id as string;
      return updateRecord(workspaceId, objectName, existingId, body);
    }
  }
  return createRecord(workspaceId, objectName, body);
}

export async function deleteRecord(workspaceId: string, objectName: string, id: string): Promise<void> {
  const object = await resolveObject(workspaceId, objectName);
  const repo = await repoFor(workspaceId, object);
  const existing = await repo.findOneBy({ id });
  if (existing) await repo.softRemove(existing);
}

export interface FindRecordsOptions {
  limit: number;
  offset?: number;
  sort?: { field: string; direction: string } | null;
  /** `leftValue` templates like `{{record.name}}`; `rightValue` is already resolved against the run context. */
  stepFilters?: StepFilter[];
  stepFilterGroups?: StepFilterGroup[];
}

/**
 * v1 approach: fetch an ordered batch, decode, filter in-memory (resolving each filter's `leftValue`
 * against `{ record: <decoded row> }`), then apply offset/limit. Avoids building a dynamic per-operand
 * SQL WHERE translator; documented trade-off — large tables should keep filters selective.
 */
export async function findRecords(
  workspaceId: string,
  objectName: string,
  opts: FindRecordsOptions,
): Promise<Record<string, unknown>[]> {
  const object = await resolveObject(workspaceId, objectName);
  const fields = await activeFields(workspaceId, object.id);
  const repo = await repoFor(workspaceId, object);

  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const batchSize = Math.min(Math.max((limit + offset) * 5, 100), 1000);

  let rows: unknown[];
  try {
    const order = opts.sort?.field ? { [opts.sort.field]: (opts.sort.direction ?? 'ASC').toUpperCase() } : undefined;
    rows = await repo.find({ order, take: batchSize });
  } catch {
    rows = await repo.find({ take: batchSize }); // invalid sort column — fall back to unsorted rather than fail the step
  }

  let decoded = (rows as Record<string, unknown>[]).map((r) => decodeRecord(fields, r));

  if (opts.stepFilters?.length) {
    decoded = decoded.filter((row) => {
      const resolvedLeft = opts.stepFilters!.map((f) => ({ ...f, leftValue: resolveInput(f.leftValue, { record: row }) }));
      return evaluateConditions(resolvedLeft, opts.stepFilterGroups ?? []);
    });
  }

  return decoded.slice(offset, offset + limit);
}
