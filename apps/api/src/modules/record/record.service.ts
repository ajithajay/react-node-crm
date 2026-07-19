import { FieldMetadataEntity, ObjectMetadataEntity } from '@saasly/database';
import { toCamelCase, type RecordListQuery } from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { workspaceDataSourceCache } from '../../lib/workspace-data-source.js';
import { applyRecordListQuery } from '../../lib/query-parser.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { decodeRecord, encodeRecordInput } from './record-field-codec.js';
import { buildCsvColumns, csvToRecordBodies, recordsToCsv } from './record-csv.js';
import { dispatchRecordWebhooks } from '../../lib/webhook-events.js';
import { dispatchWorkflowTriggers } from '../../lib/workflow-events.js';
import { logger } from '../../lib/logger.js';
import {
  assertObjectAccess,
  resolveActorRole,
  resolveFieldRestrictions,
  type ActorRole,
  type Principal,
} from './record-permission.js';

const objectRepo = () => dataSource.getRepository(ObjectMetadataEntity);
const fieldRepo = () => dataSource.getRepository(FieldMetadataEntity);

export interface RecordListResult {
  records: Record<string, unknown>[];
  page: number;
  pageSize: number;
  total: number;
}

async function resolveObject(workspaceId: string, objectNamePlural: string): Promise<ObjectMetadataEntity> {
  const object = await objectRepo().findOneBy({ workspaceId, namePlural: objectNamePlural, isActive: true });
  if (!object) throw new NotFoundError('Object not found');
  return object;
}

async function resolveActiveFields(workspaceId: string, objectMetadataId: string): Promise<FieldMetadataEntity[]> {
  return fieldRepo().findBy({ workspaceId, objectMetadataId, isActive: true });
}

async function getRepository(workspaceId: string, object: ObjectMetadataEntity) {
  const workspaceDataSource = await workspaceDataSourceCache.getWorkspaceDataSource(workspaceId);
  return workspaceDataSource.getRepository(object.nameSingular);
}

export async function listRecords(
  workspaceId: string,
  principal: Principal,
  objectNamePlural: string,
  query: RecordListQuery,
): Promise<RecordListResult> {
  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(principal, workspaceId);
  await assertObjectAccess(actor, object.id, 'read');

  const fields = await resolveActiveFields(workspaceId, object.id);
  const { restrictedForRead } = await resolveFieldRestrictions(
    actor,
    fields.map((f) => f.id),
  );

  const repository = await getRepository(workspaceId, object);
  const alias = object.nameSingular;
  const qb = repository.createQueryBuilder(alias);
  const { page, pageSize } = applyRecordListQuery(qb, alias, fields, query);

  const [rows, total] = await qb.getManyAndCount();
  return {
    records: rows.map((row) => decodeRecord(fields, row as Record<string, unknown>, restrictedForRead)),
    page,
    pageSize,
    total,
  };
}

export async function getRecord(
  workspaceId: string,
  principal: Principal,
  objectNamePlural: string,
  id: string,
): Promise<Record<string, unknown>> {
  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(principal, workspaceId);
  await assertObjectAccess(actor, object.id, 'read');

  const fields = await resolveActiveFields(workspaceId, object.id);
  const { restrictedForRead } = await resolveFieldRestrictions(
    actor,
    fields.map((f) => f.id),
  );

  const repository = await getRepository(workspaceId, object);
  const row = await repository.findOneBy({ id });
  if (!row) throw new NotFoundError('Record not found');

  return decodeRecord(fields, row as Record<string, unknown>, restrictedForRead);
}

/** ACTOR columns for created_by/updated_by — system-stamped from the caller's workspace membership. */
function actorStamp(actor: ActorRole): Record<string, unknown> {
  if (actor.member) {
    const name = `${actor.member.firstName} ${actor.member.lastName}`.trim();
    return { source: 'WORKSPACE_MEMBER', workspace_member_id: actor.member.id, name, context: null };
  }
  // API-key actor (no workspace member) — Twenty's ACTOR source 'API' (gap E3).
  return { source: 'API', workspace_member_id: null, name: actor.apiKeyName ?? 'API Key', context: null };
}

/**
 * Auto-logs a timeline activity for objects that are morph targets (have a `timeline_activities`
 * reverse field — Company/Person/Opportunity) on create/update (gap E1). Best-effort: written
 * directly into the workspace's `timeline_activity` table with the acting actor stamped.
 */
async function writeTimelineActivity(
  workspaceId: string,
  object: ObjectMetadataEntity,
  recordId: string,
  verb: string,
  actor: ActorRole,
  properties?: Record<string, unknown>,
): Promise<void> {
  const timelineObject = await objectRepo().findOneBy({ workspaceId, nameSingular: 'timeline_activity', isActive: true });
  if (!timelineObject) return;
  const repo = await getRepository(workspaceId, timelineObject);
  const row: Record<string, unknown> = {
    name: verb,
    happens_at: new Date(),
    target_target_type: object.nameSingular,
    target_target_id: recordId,
    properties: properties ?? null,
  };
  for (const [suffix, value] of Object.entries(actorStamp(actor))) {
    row[`created_by_${suffix}`] = value;
    row[`updated_by_${suffix}`] = value;
  }
  await repo.save(repo.create(row));
}

/**
 * Field-level before/after diff for an update (Twenty parity — the timeline shows "updated Field →
 * value" rather than a generic verb). Only fields the caller actually attempted to change (present in
 * `body`) are compared; ACTOR/reverse-relation fields are never diffed (system-managed / no own value).
 */
function computeFieldDiff(
  fields: FieldMetadataEntity[],
  body: Record<string, unknown>,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { label: string; before: unknown; after: unknown }> | undefined {
  const diff: Record<string, { label: string; before: unknown; after: unknown }> = {};
  for (const field of fields) {
    if (field.type === 'ACTOR' || field.type === 'MORPH_RELATION') continue;
    if (field.type === 'RELATION' && field.settings?.relationType === 'ONE_TO_MANY') continue;
    const key = toCamelCase(field.name);
    if (!(key in body)) continue;
    const beforeValue = before[key] ?? null;
    const afterValue = after[key] ?? null;
    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) continue;
    diff[field.name] = { label: field.label, before: beforeValue, after: afterValue };
  }
  return Object.keys(diff).length > 0 ? diff : undefined;
}

/** Post-mutation side effects: auto-timeline (create/update only) + webhook fan-out. Never throws. */
async function afterRecordMutation(
  workspaceId: string,
  object: ObjectMetadataEntity,
  fields: FieldMetadataEntity[],
  recordId: string,
  operation: 'created' | 'updated' | 'deleted',
  actor: ActorRole,
  record: Record<string, unknown>,
  diff?: Record<string, unknown>,
): Promise<void> {
  if (operation !== 'deleted' && fields.some((f) => f.name === 'timeline_activities')) {
    try {
      await writeTimelineActivity(
        workspaceId,
        object,
        recordId,
        `${operation === 'created' ? 'Created' : 'Updated'} ${object.labelSingular}`,
        actor,
        diff ? { diff } : undefined,
      );
    } catch (err) {
      logger.error({ err, objectId: object.id, recordId }, 'timeline activity write failed');
    }
  }
  await dispatchRecordWebhooks(workspaceId, object.nameSingular, operation, record);
  await dispatchWorkflowTriggers(
    workspaceId,
    object.nameSingular,
    operation,
    record,
    diff ? Object.keys(diff) : undefined,
  );
}

export async function createRecord(
  workspaceId: string,
  principal: Principal,
  objectNamePlural: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(principal, workspaceId);
  await assertObjectAccess(actor, object.id, 'update');

  const fields = await resolveActiveFields(workspaceId, object.id);
  const { restrictedForRead, restrictedForWrite } = await resolveFieldRestrictions(
    actor,
    fields.map((f) => f.id),
  );

  const data = encodeRecordInput(fields, body, restrictedForWrite);
  const stamp = actorStamp(actor);
  for (const [suffix, value] of Object.entries(stamp)) {
    data[`created_by_${suffix}`] = value;
    data[`updated_by_${suffix}`] = value;
  }

  const repository = await getRepository(workspaceId, object);
  const saved = await repository.save(repository.create(data));
  const decoded = decodeRecord(fields, saved as Record<string, unknown>, restrictedForRead);
  await afterRecordMutation(workspaceId, object, fields, decoded.id as string, 'created', actor, decoded);
  return decoded;
}

export async function updateRecord(
  workspaceId: string,
  principal: Principal,
  objectNamePlural: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(principal, workspaceId);
  await assertObjectAccess(actor, object.id, 'update');

  const fields = await resolveActiveFields(workspaceId, object.id);
  const { restrictedForRead, restrictedForWrite } = await resolveFieldRestrictions(
    actor,
    fields.map((f) => f.id),
  );

  const repository = await getRepository(workspaceId, object);
  const existing = await repository.findOneBy({ id });
  if (!existing) throw new NotFoundError('Record not found');
  const before = decodeRecord(fields, existing as Record<string, unknown>, restrictedForRead);

  const data = encodeRecordInput(fields, body, restrictedForWrite);
  const stamp = actorStamp(actor);
  for (const [suffix, value] of Object.entries(stamp)) data[`updated_by_${suffix}`] = value;

  const saved = await repository.save(repository.merge(existing, data));
  const decoded = decodeRecord(fields, saved as Record<string, unknown>, restrictedForRead);
  const diff = computeFieldDiff(fields, body, before, decoded);
  await afterRecordMutation(workspaceId, object, fields, id, 'updated', actor, decoded, diff);
  return decoded;
}

export async function deleteRecord(
  workspaceId: string,
  principal: Principal,
  objectNamePlural: string,
  id: string,
  hard: boolean,
): Promise<void> {
  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(principal, workspaceId);
  await assertObjectAccess(actor, object.id, hard ? 'destroy' : 'softDelete');

  const repository = await getRepository(workspaceId, object);
  const existing = await repository.findOneBy({ id });
  if (!existing) throw new NotFoundError('Record not found');

  if (hard) await repository.remove(existing);
  else await repository.softRemove(existing);

  await dispatchRecordWebhooks(workspaceId, object.nameSingular, 'deleted', { id });
  await dispatchWorkflowTriggers(workspaceId, object.nameSingular, 'deleted', { id });
}

/**
 * Synchronous CSV export/import (no `csv-export`/`csv-import` worker job, despite the queue names
 * being reserved in solution-approach.md §7) — a deliberate v1 scope cut, not an oversight: a queued
 * job needs a place to deliver the result (a file the user downloads once it's ready, notifications,
 * etc.), which is real additional infrastructure this pass didn't need to justify for reasonably-sized
 * CSVs. Both directions are capped and documented below; revisit with the queue if a real workspace's
 * dataset outgrows a single synchronous request.
 */
const CSV_EXPORT_MAX_ROWS = 5000;
const CSV_IMPORT_MAX_ROWS = 2000;

export async function exportRecordsCsv(
  workspaceId: string,
  principal: Principal,
  objectNamePlural: string,
  query: RecordListQuery,
): Promise<{ filename: string; csv: string }> {
  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(principal, workspaceId);
  await assertObjectAccess(actor, object.id, 'read');

  const fields = await resolveActiveFields(workspaceId, object.id);
  const { restrictedForRead } = await resolveFieldRestrictions(
    actor,
    fields.map((f) => f.id),
  );

  const repository = await getRepository(workspaceId, object);
  const alias = object.nameSingular;
  const qb = repository.createQueryBuilder(alias);
  applyRecordListQuery(qb, alias, fields, { ...query, page: 1, pageSize: CSV_EXPORT_MAX_ROWS });

  const rows = await qb.getMany();
  const decoded = rows.map((row) => decodeRecord(fields, row as Record<string, unknown>, restrictedForRead));
  const columns = buildCsvColumns(fields, restrictedForRead);

  return { filename: `${object.namePlural}.csv`, csv: recordsToCsv(columns, decoded) };
}

export interface ImportSummary {
  created: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export async function importRecordsCsv(
  workspaceId: string,
  principal: Principal,
  objectNamePlural: string,
  csvText: string,
): Promise<ImportSummary> {
  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(principal, workspaceId);
  await assertObjectAccess(actor, object.id, 'update');

  const fields = await resolveActiveFields(workspaceId, object.id);
  const { restrictedForRead, restrictedForWrite } = await resolveFieldRestrictions(
    actor,
    fields.map((f) => f.id),
  );

  const columns = buildCsvColumns(fields, restrictedForRead);
  const bodies = csvToRecordBodies(columns, csvText);
  if (bodies.length > CSV_IMPORT_MAX_ROWS) {
    throw new AppError(`CSV has ${bodies.length} rows; the import limit is ${CSV_IMPORT_MAX_ROWS}`, 400);
  }

  const repository = await getRepository(workspaceId, object);
  const stamp = actorStamp(actor);
  const summary: ImportSummary = { created: 0, failed: 0, errors: [] };

  for (let i = 0; i < bodies.length; i += 1) {
    try {
      const data = encodeRecordInput(fields, bodies[i]!, restrictedForWrite);
      for (const [suffix, value] of Object.entries(stamp)) {
        data[`created_by_${suffix}`] = value;
        data[`updated_by_${suffix}`] = value;
      }
      const saved = await repository.save(repository.create(data));
      const decoded = decodeRecord(fields, saved as Record<string, unknown>, restrictedForRead);
      await afterRecordMutation(workspaceId, object, fields, decoded.id as string, 'created', actor, decoded);
      summary.created += 1;
    } catch (err) {
      summary.failed += 1;
      // +2: 1-indexed, plus the header row.
      summary.errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return summary;
}
