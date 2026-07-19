import type { SelectQueryBuilder } from 'typeorm';
import { FieldMetadataEntity, RowLevelPermissionEntity } from '@saasly/database';
import { RowLevelPermissionValueMode, type ViewFilterOperand } from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { AppError } from '../../lib/errors.js';
import { applyLogicalConditions, buildFilterableFieldIndex } from '../../lib/query-parser.js';
import type { ActorRole } from './record-permission.js';

const rowLevelPermissionRepo = () => dataSource.getRepository(RowLevelPermissionEntity);

/**
 * Injects the caller's role's row-level permission rule (if any) into the query as an extra WHERE
 * clause, restricting which *existing* rows are visible/mutable. Applies uniformly to read,
 * update, and delete (no per-operation split) and to both workspace members and API keys — there's
 * no create-time enforcement (a row-level rule can't gate a row that doesn't exist yet, matching
 * Twenty's own behavior). Admins (`canUpdateAllSettings`) bypass entirely, same as every other
 * permission check in this module.
 *
 * A `CURRENT_USER`-valued condition resolves against the caller's workspace-member id. An API-key
 * caller has none, so such a condition is given `null` — which every comparison operator (`=`/`!=`
 * against NULL in SQL) evaluates to not-true, i.e. the rule denies everything for that caller
 * rather than silently skipping the check. This is a deliberate, conservative default.
 */
export async function applyRowLevelPermission(
  qb: SelectQueryBuilder<object>,
  alias: string,
  actor: ActorRole,
  objectMetadataId: string,
  fields: FieldMetadataEntity[],
): Promise<void> {
  if (actor.role.canUpdateAllSettings) return;

  const rules = await rowLevelPermissionRepo().find({
    where: { roleId: actor.role.id, objectMetadataId },
    order: { position: 'ASC' },
  });
  if (rules.length === 0) return;

  const filterable = buildFilterableFieldIndex(fields);
  const keyByFieldId = new Map<string, string>();
  for (const [key, { field }] of filterable) {
    if (!keyByFieldId.has(field.id)) keyByFieldId.set(field.id, key);
  }

  const conditions = rules.map((rule) => {
    const columnKey = keyByFieldId.get(rule.fieldMetadataId);
    if (!columnKey) {
      // The field the rule targets is no longer filterable (deactivated, type changed, etc.) —
      // fail closed rather than silently dropping a security rule.
      throw new AppError('A row-level permission rule references a field that is no longer available', 500);
    }
    const value =
      rule.valueMode === RowLevelPermissionValueMode.CURRENT_USER ? (actor.member?.id ?? null) : rule.value;
    return {
      fieldMetadataId: rule.fieldMetadataId,
      columnKey,
      operand: rule.operand as ViewFilterOperand,
      value,
      logicalOperator: rule.logicalOperator as 'AND' | 'OR',
    };
  });

  applyLogicalConditions(qb, alias, filterable, conditions);
}
