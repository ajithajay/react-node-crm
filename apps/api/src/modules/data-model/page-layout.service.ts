import {
  FieldMetadataEntity,
  ObjectMetadataEntity,
  PageLayoutEntity,
  PageLayoutSectionEntity,
  PageLayoutTabEntity,
  PageLayoutType,
  PageLayoutWidgetEntity,
  PageLayoutWidgetType,
  computeFieldsWidgetGroups,
  isFieldsGroupEligible,
  isReverseRelationWidgetField,
  seedPageLayoutForObject,
  writeFieldsWidgetGroups,
} from '@saasly/database';
import {
  type PageLayoutDto,
  type PageLayoutWidgetConfiguration,
  type PageLayoutWidgetType as SharedPageLayoutWidgetType,
  type SavePageLayoutRequest,
} from '@saasly/shared';
import type { EntityManager } from 'typeorm';
import { dataSource } from '../../lib/db.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { record } from '../audit-log/audit-log.service.js';

const objectRepo = () => dataSource.getRepository(ObjectMetadataEntity);
const fieldRepo = () => dataSource.getRepository(FieldMetadataEntity);
const layoutRepo = () => dataSource.getRepository(PageLayoutEntity);
const tabRepo = () => dataSource.getRepository(PageLayoutTabEntity);
const widgetRepo = () => dataSource.getRepository(PageLayoutWidgetEntity);
const sectionRepo = () => dataSource.getRepository(PageLayoutSectionEntity);

const DEFAULT_FIELDS_WIDGET_CONFIG: PageLayoutWidgetConfiguration = {
  showMoreFieldsButton: false,
  autoVisibleNewFields: true,
};

// ---- Read ----

export async function getPageLayout(workspaceId: string, objectMetadataId: string): Promise<PageLayoutDto> {
  const object = await objectRepo().findOneBy({ id: objectMetadataId, workspaceId });
  if (!object) throw new NotFoundError('Object not found');

  let layout = await layoutRepo().findOneBy({
    workspaceId,
    objectMetadataId,
    type: PageLayoutType.RECORD_PAGE,
  });
  if (!layout) layout = await synthesizeDefaultLayout(workspaceId, object);

  return loadLayout(workspaceId, layout);
}

/** Serialize a persisted layout into the nested DTO the client edits. */
async function loadLayout(workspaceId: string, layout: PageLayoutEntity): Promise<PageLayoutDto> {
  // This module only ever loads RECORD_PAGE layouts, which always carry a real objectMetadataId
  // (DASHBOARD layouts, which may have a null objectMetadataId, are handled by the dashboard module).
  const objectMetadataId = layout.objectMetadataId!;
  const [tabs, fields] = await Promise.all([
    tabRepo().find({ where: { workspaceId, pageLayoutId: layout.id }, order: { position: 'ASC' } }),
    fieldRepo().find({ where: { workspaceId, objectMetadataId } }),
  ]);
  const fieldById = new Map(fields.map((f) => [f.id, f]));

  const tabIds = tabs.map((t) => t.id);
  const widgets = tabIds.length
    ? await widgetRepo()
        .createQueryBuilder('w')
        .where('w.workspace_id = :workspaceId', { workspaceId })
        .andWhere('w.page_layout_tab_id IN (:...tabIds)', { tabIds })
        .orderBy('w.position', 'ASC')
        .getMany()
    : [];
  const widgetIds = widgets.map((w) => w.id);
  const sections = widgetIds.length
    ? await sectionRepo()
        .createQueryBuilder('s')
        .where('s.workspace_id = :workspaceId', { workspaceId })
        .andWhere('s.page_layout_widget_id IN (:...widgetIds)', { widgetIds })
        .orderBy('s.position', 'ASC')
        .getMany()
    : [];

  const sectionsByWidget = new Map<string, PageLayoutSectionEntity[]>();
  for (const s of sections) {
    if (!s.pageLayoutWidgetId) continue;
    const arr = sectionsByWidget.get(s.pageLayoutWidgetId) ?? [];
    arr.push(s);
    sectionsByWidget.set(s.pageLayoutWidgetId, arr);
  }

  return {
    id: layout.id,
    objectMetadataId,
    type: layout.type,
    name: layout.name,
    tabs: tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      icon: tab.icon,
      position: tab.position,
      isVisible: tab.isVisible,
      isPinned: tab.isPinned,
      widgets: widgets
        .filter((w) => w.pageLayoutTabId === tab.id)
        .map((w) => ({
          id: w.id,
          // This module only ever loads RECORD_PAGE layouts, whose widgets are always one of the
          // record-page types — the DB enum is a superset (also covers Phase 7 dashboard widgets).
          type: w.type as SharedPageLayoutWidgetType,
          title: w.title,
          position: w.position,
          isVisible: w.isVisible,
          configuration: (w.configuration as PageLayoutWidgetConfiguration) ?? {},
          groups:
            w.type === PageLayoutWidgetType.FIELDS
              ? (sectionsByWidget.get(w.id) ?? []).map((s) => ({
                  id: s.id,
                  label: s.label,
                  isVisible: s.isVisible,
                  position: s.position,
                  fields: (s.fieldMetadataIds ?? [])
                    .map((fid) => fieldById.get(fid))
                    .filter((f): f is FieldMetadataEntity => !!f)
                    .map((f) => ({
                      fieldMetadataId: f.id,
                      isVisible: f.isVisibleInRecordPage,
                      label: f.label,
                      icon: f.icon,
                      fieldType: f.type,
                    })),
                }))
              : [],
        })),
    })),
  };
}

/**
 * Fallback for objects with no persisted layout (pre-existing workspaces, or a fresh custom object
 * before its create hook ran). Delegates to the shared builder so the result is byte-identical to
 * what workspace provisioning seeds.
 */
async function synthesizeDefaultLayout(workspaceId: string, object: ObjectMetadataEntity): Promise<PageLayoutEntity> {
  try {
    return await dataSource.transaction((m) => seedPageLayoutForObject(m, workspaceId, object));
  } catch (err) {
    // Lost a create race against a concurrent GET — the unique index rejected the second insert.
    const existing = await layoutRepo().findOneBy({
      workspaceId,
      objectMetadataId: object.id,
      type: PageLayoutType.RECORD_PAGE,
    });
    if (existing) return existing;
    throw err;
  }
}

// ---- Write ----

export async function savePageLayout(
  workspaceId: string,
  objectMetadataId: string,
  actorUserId: string | null,
  req: SavePageLayoutRequest,
): Promise<PageLayoutDto> {
  const object = await objectRepo().findOneBy({ id: objectMetadataId, workspaceId });
  if (!object) throw new NotFoundError('Object not found');

  const fields = await fieldRepo().find({ where: { workspaceId, objectMetadataId } });
  const fieldIds = new Set(fields.map((f) => f.id));

  // Validate every referenced field belongs to this object.
  for (const tab of req.tabs) {
    for (const widget of tab.widgets) {
      for (const group of widget.groups ?? []) {
        for (const f of group.fields) {
          if (!fieldIds.has(f.fieldMetadataId)) {
            throw new ConflictError('Field does not belong to this object');
          }
        }
      }
    }
  }

  await dataSource.transaction(async (m: EntityManager) => {
    const lRepo = m.getRepository(PageLayoutEntity);
    let layout = await lRepo.findOneBy({ workspaceId, objectMetadataId, type: PageLayoutType.RECORD_PAGE });
    if (!layout) {
      layout = await lRepo.save(
        lRepo.create({
          workspaceId,
          objectMetadataId,
          type: PageLayoutType.RECORD_PAGE,
          name: `${object.labelSingular} Record Page`,
        }),
      );
    }

    // Rebuild the whole tree (tabs → widgets → sections all cascade-delete off the layout's tabs).
    await m.getRepository(PageLayoutTabEntity).delete({ workspaceId, pageLayoutId: layout.id });
    await m.getRepository(PageLayoutSectionEntity).delete({ workspaceId, objectMetadataId });

    const fieldVisibility = new Map<string, boolean>();

    for (let ti = 0; ti < req.tabs.length; ti++) {
      const tabInput = req.tabs[ti]!;
      const tab = await m.getRepository(PageLayoutTabEntity).save(
        m.getRepository(PageLayoutTabEntity).create({
          workspaceId,
          pageLayoutId: layout.id,
          title: tabInput.title,
          icon: tabInput.icon ?? null,
          position: ti,
          isVisible: tabInput.isVisible,
          isPinned: tabInput.isPinned,
        }),
      );
      for (let wi = 0; wi < tabInput.widgets.length; wi++) {
        const widgetInput = tabInput.widgets[wi]!;
        const widget = await m.getRepository(PageLayoutWidgetEntity).save(
          m.getRepository(PageLayoutWidgetEntity).create({
            workspaceId,
            pageLayoutTabId: tab.id,
            type: widgetInput.type,
            title: widgetInput.title,
            position: wi,
            isVisible: widgetInput.isVisible,
            configuration: widgetInput.configuration ?? {},
          }),
        );
        if (widgetInput.type === PageLayoutWidgetType.FIELDS && widgetInput.groups) {
          await m.getRepository(PageLayoutSectionEntity).save(
            widgetInput.groups.map((g, gi) =>
              m.getRepository(PageLayoutSectionEntity).create({
                workspaceId,
                objectMetadataId,
                pageLayoutWidgetId: widget.id,
                label: g.label,
                position: gi,
                isVisible: g.isVisible,
                fieldMetadataIds: g.fields.map((f) => f.fieldMetadataId),
              }),
            ),
          );
          for (const g of widgetInput.groups) {
            for (const f of g.fields) fieldVisibility.set(f.fieldMetadataId, f.isVisible);
          }
        }
      }
    }

    // Persist per-field record-page visibility for every field placed in a group.
    for (const [fid, isVisible] of fieldVisibility) {
      await m.getRepository(FieldMetadataEntity).update({ id: fid, workspaceId }, { isVisibleInRecordPage: isVisible });
    }
  });

  await record(workspaceId, actorUserId, 'data_model.object_updated', {
    objectMetadataId,
    pageLayoutUpdated: true,
  });
  const layout = await layoutRepo().findOneByOrFail({ workspaceId, objectMetadataId, type: PageLayoutType.RECORD_PAGE });
  return loadLayout(workspaceId, layout);
}

export async function resetPageLayout(
  workspaceId: string,
  objectMetadataId: string,
  actorUserId: string | null,
): Promise<PageLayoutDto> {
  const object = await objectRepo().findOneBy({ id: objectMetadataId, workspaceId });
  if (!object) throw new NotFoundError('Object not found');

  await dataSource.transaction(async (m) => {
    await m.getRepository(PageLayoutEntity).delete({ workspaceId, objectMetadataId, type: PageLayoutType.RECORD_PAGE });
    await m.getRepository(PageLayoutSectionEntity).delete({ workspaceId, objectMetadataId });
    // "Default" means all fields visible again — field visibility is part of the record-page default.
    await m
      .getRepository(FieldMetadataEntity)
      .update({ workspaceId, objectMetadataId }, { isVisibleInRecordPage: true });
  });

  await record(workspaceId, actorUserId, 'data_model.object_updated', { objectMetadataId, pageLayoutReset: true });
  const layout = await synthesizeDefaultLayout(workspaceId, object);
  return loadLayout(workspaceId, layout);
}

/** Reset a single widget to its default state — a FIELDS widget's groups are recomputed from the
 * object's seed sections (same logic as a full layout reset, scoped to just this widget); any other
 * widget just goes back to visible with an empty configuration. */
export async function resetWidgetToDefault(
  workspaceId: string,
  objectMetadataId: string,
  widgetId: string,
  actorUserId: string | null,
): Promise<PageLayoutDto> {
  const [object, widget] = await Promise.all([
    objectRepo().findOneBy({ id: objectMetadataId, workspaceId }),
    widgetRepo().findOneBy({ id: widgetId, workspaceId }),
  ]);
  if (!object) throw new NotFoundError('Object not found');
  if (!widget) throw new NotFoundError('Widget not found');

  await dataSource.transaction(async (m) => {
    if (widget.type === PageLayoutWidgetType.FIELDS) {
      const fields = await m.getRepository(FieldMetadataEntity).find({ where: { workspaceId, objectMetadataId } });
      const groups = computeFieldsWidgetGroups(object, fields);
      await writeFieldsWidgetGroups(m, workspaceId, objectMetadataId, widgetId, groups, fields);
      const widgetEntity = await m.getRepository(PageLayoutWidgetEntity).findOneByOrFail({ id: widgetId, workspaceId });
      widgetEntity.isVisible = true;
      widgetEntity.configuration = DEFAULT_FIELDS_WIDGET_CONFIG;
      await m.getRepository(PageLayoutWidgetEntity).save(widgetEntity);
    } else {
      const widgetEntity = await m.getRepository(PageLayoutWidgetEntity).findOneByOrFail({ id: widgetId, workspaceId });
      widgetEntity.isVisible = true;
      widgetEntity.configuration = {};
      await m.getRepository(PageLayoutWidgetEntity).save(widgetEntity);
    }
  });

  await record(workspaceId, actorUserId, 'data_model.object_updated', { objectMetadataId, widgetReset: widgetId });
  const layout = await layoutRepo().findOneByOrFail({ workspaceId, objectMetadataId, type: PageLayoutType.RECORD_PAGE });
  return loadLayout(workspaceId, layout);
}

/**
 * Called after a new field/relation is created on an object: wire it into that object's existing
 * record-page layout so it shows up without a manual edit. A scalar/forward-relation field is
 * appended to the FIELDS widget's first group (visible/hidden per `autoVisibleNewFields`); a
 * collection/reverse relation becomes a new FIELD widget on the Home tab. A no-op if the object has
 * no persisted layout yet (the next `getPageLayout` synthesizes one from current fields directly).
 */
export async function appendFieldToLayout(workspaceId: string, objectMetadataId: string, fieldId: string): Promise<void> {
  const layout = await layoutRepo().findOneBy({ workspaceId, objectMetadataId, type: PageLayoutType.RECORD_PAGE });
  if (!layout) return;

  const homeTab = await tabRepo().findOne({ where: { workspaceId, pageLayoutId: layout.id }, order: { position: 'ASC' } });
  if (!homeTab) return;

  const field = await fieldRepo().findOneBy({ id: fieldId, workspaceId });
  if (!field) return;

  // Collection/reverse relation → its own FIELD widget (People, Opportunities, …).
  if (isReverseRelationWidgetField(field)) {
    const siblings = await widgetRepo().find({ where: { workspaceId, pageLayoutTabId: homeTab.id }, order: { position: 'DESC' }, take: 1 });
    const position = (siblings[0]?.position ?? -1) + 1;
    await widgetRepo().save(
      widgetRepo().create({
        workspaceId,
        pageLayoutTabId: homeTab.id,
        type: PageLayoutWidgetType.FIELD,
        title: field.label,
        position,
        isVisible: true,
        configuration: { fieldMetadataId: field.id, displayMode: 'CARD' },
      }),
    );
    return;
  }

  if (!isFieldsGroupEligible(field)) return;

  const fieldsWidget = await widgetRepo().findOneBy({
    workspaceId,
    pageLayoutTabId: homeTab.id,
    type: PageLayoutWidgetType.FIELDS,
  });
  if (!fieldsWidget) return;

  const config = (fieldsWidget.configuration as PageLayoutWidgetConfiguration) ?? {};
  const visible = config.autoVisibleNewFields !== false;

  const sections = await sectionRepo().find({
    where: { workspaceId, pageLayoutWidgetId: fieldsWidget.id },
    order: { position: 'ASC' },
  });
  const alreadyPlaced = sections.some((s) => (s.fieldMetadataIds ?? []).includes(fieldId));
  if (alreadyPlaced) return;

  // Append to the first non-System group (so new fields land in "General", not the System group).
  const target = sections.find((s) => s.label !== 'System') ?? sections[0];
  if (target) {
    target.fieldMetadataIds = [...(target.fieldMetadataIds ?? []), fieldId];
    await sectionRepo().save(target);
  } else {
    await sectionRepo().save(
      sectionRepo().create({
        workspaceId,
        objectMetadataId,
        pageLayoutWidgetId: fieldsWidget.id,
        label: 'General',
        position: 0,
        isVisible: true,
        fieldMetadataIds: [fieldId],
      }),
    );
  }
  if (!visible) {
    await fieldRepo().update({ id: fieldId, workspaceId }, { isVisibleInRecordPage: false });
  }
}
