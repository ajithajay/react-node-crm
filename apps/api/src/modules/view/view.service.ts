import {
  FieldMetadataEntity,
  ObjectMetadataEntity,
  ViewEntity,
  ViewFieldEntity,
  ViewFilterEntity,
  ViewGroupEntity,
  ViewSortEntity,
} from '@saasly/database';
import {
  FieldMetadataType,
  type CreateViewRequest,
  type SetViewFieldsRequest,
  type SetViewFiltersRequest,
  type SetViewGroupsRequest,
  type SetViewSortsRequest,
  type UpdateViewRequest,
  type ViewFilterOperand,
  type ViewSortDirection,
  type ViewType,
} from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';

const viewRepo = () => dataSource.getRepository(ViewEntity);
const viewFieldRepo = () => dataSource.getRepository(ViewFieldEntity);
const viewFilterRepo = () => dataSource.getRepository(ViewFilterEntity);
const viewSortRepo = () => dataSource.getRepository(ViewSortEntity);
const viewGroupRepo = () => dataSource.getRepository(ViewGroupEntity);
const objectRepo = () => dataSource.getRepository(ObjectMetadataEntity);
const fieldRepo = () => dataSource.getRepository(FieldMetadataEntity);

export interface ViewSummary {
  id: string;
  objectMetadataId: string;
  name: string;
  type: string;
  icon: string | null;
  position: number;
  isCompact: boolean;
  isDefault: boolean;
  kanbanFieldMetadataId: string | null;
}

function toSummary(view: ViewEntity): ViewSummary {
  return {
    id: view.id,
    objectMetadataId: view.objectMetadataId,
    name: view.name,
    type: view.type,
    icon: view.icon,
    position: view.position,
    isCompact: view.isCompact,
    isDefault: view.isDefault,
    kanbanFieldMetadataId: view.kanbanFieldMetadataId,
  };
}

async function requireObject(workspaceId: string, objectMetadataId: string): Promise<ObjectMetadataEntity> {
  const object = await objectRepo().findOneBy({ id: objectMetadataId, workspaceId });
  if (!object) throw new NotFoundError('Object not found');
  return object;
}

async function requireView(workspaceId: string, viewId: string): Promise<ViewEntity> {
  const view = await viewRepo().findOneBy({ id: viewId, workspaceId });
  if (!view) throw new NotFoundError('View not found');
  return view;
}

/** Every field referenced in `fieldMetadataIds` must belong to the view's own object. */
async function assertFieldsBelongToObject(
  workspaceId: string,
  objectMetadataId: string,
  fieldMetadataIds: string[],
): Promise<void> {
  if (fieldMetadataIds.length === 0) return;
  const count = await fieldRepo().count({
    where: fieldMetadataIds.map((id) => ({ id, workspaceId, objectMetadataId })),
  });
  if (count !== new Set(fieldMetadataIds).size) {
    throw new ConflictError('One or more fields do not belong to this view’s object');
  }
}

export async function listViews(workspaceId: string, objectMetadataId: string): Promise<ViewSummary[]> {
  await requireObject(workspaceId, objectMetadataId);
  const views = await viewRepo().findBy({ workspaceId, objectMetadataId });
  return views.sort((a, b) => a.position - b.position).map(toSummary);
}

export interface ViewFieldSummary {
  fieldMetadataId: string;
  position: number;
  isVisible: boolean;
  size: number;
}
export interface ViewFilterSummary {
  id: string;
  fieldMetadataId: string;
  operand: string;
  value: unknown;
  position: number;
}
export interface ViewSortSummary {
  fieldMetadataId: string;
  direction: string;
}
export interface ViewGroupSummary {
  fieldValue: string;
  isVisible: boolean;
  position: number;
}

export interface ViewDetail extends ViewSummary {
  fields: ViewFieldSummary[];
  filters: ViewFilterSummary[];
  sorts: ViewSortSummary[];
  groups: ViewGroupSummary[];
}

export async function getView(workspaceId: string, viewId: string): Promise<ViewDetail> {
  const view = await requireView(workspaceId, viewId);
  const [fields, filters, sorts, groups] = await Promise.all([
    viewFieldRepo().findBy({ viewId }),
    viewFilterRepo().findBy({ viewId }),
    viewSortRepo().findBy({ viewId }),
    viewGroupRepo().findBy({ viewId }),
  ]);

  // No explicit column config yet — default to every active "column-shaped" field, in creation order,
  // all visible. Reverse relations (People/Opportunities-style ONE_TO_MANY fields, including morph
  // reverses like Notes/Tasks/Attachments) and MORPH_RELATION forward fields have no meaningful table
  // cell (record-field-codec.ts doesn't decode them at all) — matches Twenty, which surfaces those as
  // record-detail relation widgets instead of table columns, never as default columns.
  const fieldConfig =
    fields.length > 0
      ? fields.sort((a, b) => a.position - b.position).map((f) => ({
          fieldMetadataId: f.fieldMetadataId,
          position: f.position,
          isVisible: f.isVisible,
          size: f.size,
        }))
      : (await fieldRepo().findBy({ workspaceId, objectMetadataId: view.objectMetadataId, isActive: true }))
          .filter(
            (f) =>
              f.type !== FieldMetadataType.MORPH_RELATION &&
              !(f.type === FieldMetadataType.RELATION && f.settings?.relationType === 'ONE_TO_MANY'),
          )
          .map((f, i) => ({ fieldMetadataId: f.id, position: i, isVisible: true, size: 150 }));

  return {
    ...toSummary(view),
    fields: fieldConfig,
    filters: filters
      .sort((a, b) => a.position - b.position)
      .map((f) => ({ id: f.id, fieldMetadataId: f.fieldMetadataId, operand: f.operand, value: f.value, position: f.position })),
    sorts: sorts.map((s) => ({ fieldMetadataId: s.fieldMetadataId, direction: s.direction })),
    groups: groups.sort((a, b) => a.position - b.position).map((g) => ({
      fieldValue: g.fieldValue,
      isVisible: g.isVisible,
      position: g.position,
    })),
  };
}

export async function createView(
  workspaceId: string,
  input: CreateViewRequest,
): Promise<ViewSummary> {
  await requireObject(workspaceId, input.objectMetadataId);

  const maxPosition = await viewRepo()
    .createQueryBuilder('v')
    .select('MAX(v.position)', 'max')
    .where('v.workspace_id = :workspaceId AND v.object_metadata_id = :objectMetadataId', {
      workspaceId,
      objectMetadataId: input.objectMetadataId,
    })
    .getRawOne<{ max: number | null }>();

  const view = await viewRepo().save(
    viewRepo().create({
      workspaceId,
      objectMetadataId: input.objectMetadataId,
      name: input.name,
      type: input.type as ViewType,
      icon: input.icon ?? null,
      position: (maxPosition?.max ?? -1) + 1,
    }),
  );
  return toSummary(view);
}

export async function updateView(
  workspaceId: string,
  viewId: string,
  input: UpdateViewRequest,
): Promise<ViewSummary> {
  const view = await requireView(workspaceId, viewId);

  if (input.kanbanFieldMetadataId !== undefined && input.kanbanFieldMetadataId !== null) {
    await assertFieldsBelongToObject(workspaceId, view.objectMetadataId, [input.kanbanFieldMetadataId]);
  }

  // The default "All <Object>" view is locked from renaming (Twenty's ViewKey.INDEX). Filters/sorts/
  // fields/compact/group-by can still be changed — only its name/deletion are protected.
  if (view.isDefault && input.name !== undefined && input.name !== view.name) {
    throw new ConflictError('The default view cannot be renamed');
  }

  if (input.name !== undefined) view.name = input.name;
  if (input.icon !== undefined) view.icon = input.icon;
  if (input.isCompact !== undefined) view.isCompact = input.isCompact;
  if (input.kanbanFieldMetadataId !== undefined) view.kanbanFieldMetadataId = input.kanbanFieldMetadataId;
  if (input.position !== undefined) view.position = input.position;

  const saved = await viewRepo().save(view);
  return toSummary(saved);
}

export async function deleteView(workspaceId: string, viewId: string): Promise<void> {
  const view = await requireView(workspaceId, viewId);
  if (view.isDefault) throw new ConflictError('The default view cannot be deleted');
  await viewRepo().remove(view);
}

export async function setViewFields(
  workspaceId: string,
  viewId: string,
  input: SetViewFieldsRequest,
): Promise<ViewFieldSummary[]> {
  const view = await requireView(workspaceId, viewId);
  await assertFieldsBelongToObject(
    workspaceId,
    view.objectMetadataId,
    input.map((f) => f.fieldMetadataId),
  );

  await viewFieldRepo().delete({ viewId });
  const rows = await viewFieldRepo().save(
    input.map((f, position) =>
      viewFieldRepo().create({
        viewId,
        fieldMetadataId: f.fieldMetadataId,
        position,
        isVisible: f.isVisible,
        size: f.size,
      }),
    ),
  );
  return rows.map((f) => ({ fieldMetadataId: f.fieldMetadataId, position: f.position, isVisible: f.isVisible, size: f.size }));
}

export async function setViewFilters(
  workspaceId: string,
  viewId: string,
  input: SetViewFiltersRequest,
): Promise<ViewFilterSummary[]> {
  const view = await requireView(workspaceId, viewId);
  await assertFieldsBelongToObject(
    workspaceId,
    view.objectMetadataId,
    input.map((f) => f.fieldMetadataId),
  );

  await viewFilterRepo().delete({ viewId });
  const rows = await viewFilterRepo().save(
    input.map((f, position) =>
      viewFilterRepo().create({
        viewId,
        fieldMetadataId: f.fieldMetadataId,
        operand: f.operand as ViewFilterOperand,
        value: f.value ?? null,
        position,
      }),
    ),
  );
  return rows.map((f) => ({ id: f.id, fieldMetadataId: f.fieldMetadataId, operand: f.operand, value: f.value, position: f.position }));
}

export async function setViewSorts(
  workspaceId: string,
  viewId: string,
  input: SetViewSortsRequest,
): Promise<ViewSortSummary[]> {
  const view = await requireView(workspaceId, viewId);
  await assertFieldsBelongToObject(
    workspaceId,
    view.objectMetadataId,
    input.map((s) => s.fieldMetadataId),
  );

  await viewSortRepo().delete({ viewId });
  const rows = await viewSortRepo().save(
    input.map((s) =>
      viewSortRepo().create({ viewId, fieldMetadataId: s.fieldMetadataId, direction: s.direction as ViewSortDirection }),
    ),
  );
  return rows.map((s) => ({ fieldMetadataId: s.fieldMetadataId, direction: s.direction }));
}

export async function setViewGroups(
  workspaceId: string,
  viewId: string,
  input: SetViewGroupsRequest,
): Promise<ViewGroupSummary[]> {
  const view = await requireView(workspaceId, viewId);
  if (!view.kanbanFieldMetadataId) {
    throw new ConflictError('Set a group-by field on this view before configuring groups');
  }

  await viewGroupRepo().delete({ viewId });
  const rows = await viewGroupRepo().save(
    input.map((g, position) =>
      viewGroupRepo().create({
        viewId,
        fieldMetadataId: view.kanbanFieldMetadataId!,
        fieldValue: g.fieldValue,
        isVisible: g.isVisible,
        position,
      }),
    ),
  );
  return rows.map((g) => ({ fieldValue: g.fieldValue, isVisible: g.isVisible, position: g.position }));
}
