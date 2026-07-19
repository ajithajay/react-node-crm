import type { DataSource } from 'typeorm';
import { FieldMetadataEntity } from '../entities/field-metadata.entity.js';
import { ObjectMetadataEntity } from '../entities/object-metadata.entity.js';
import { STANDARD_OBJECTS } from './standard-objects.seed.js';

/**
 * `duplicateCriteria` defaults for standard objects were added after some workspaces were already
 * provisioned — new workspaces get it from `STANDARD_OBJECTS` at seed time (see
 * `workspace-manager.service.ts`), but existing ones never had it set. Retroactively fills it in
 * for standard (non-custom) Company/Person/Opportunity objects that don't have criteria configured
 * yet. Idempotent (only touches objects where `duplicateCriteria` is still null) and cheap, so
 * safe to run on every boot alongside `backfillSearchVectorColumn`.
 */
export async function backfillDuplicateCriteria(coreDataSource: DataSource): Promise<void> {
  const defsByNameSingular = new Map(
    STANDARD_OBJECTS.filter((def) => def.duplicateCriteria && def.duplicateCriteria.length > 0).map((def) => [
      def.nameSingular,
      def.duplicateCriteria!,
    ]),
  );
  if (defsByNameSingular.size === 0) return;

  const objectRepo = coreDataSource.getRepository(ObjectMetadataEntity);
  const candidates = (await objectRepo.findBy({ isCustom: false })).filter(
    (o) => o.duplicateCriteria == null && defsByNameSingular.has(o.nameSingular),
  );

  for (const object of candidates) {
    const def = defsByNameSingular.get(object.nameSingular)!;
    const fields = await coreDataSource
      .getRepository(FieldMetadataEntity)
      .findBy({ workspaceId: object.workspaceId, objectMetadataId: object.id });
    const fieldIdByName = new Map(fields.map((f) => [f.name, f.id]));

    const resolved = def
      .map((group) => group.map((name) => fieldIdByName.get(name)).filter((id): id is string => !!id))
      .filter((group) => group.length > 0);
    if (resolved.length === 0) continue;

    object.duplicateCriteria = resolved;
    await objectRepo.save(object);
  }
}
