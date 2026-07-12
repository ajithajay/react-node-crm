import {
  FieldMetadataEntity,
  ObjectMetadataEntity,
  PageLayoutEntity,
  PageLayoutSectionEntity,
  PageLayoutTabEntity,
  PageLayoutType,
  PageLayoutWidgetEntity,
  PageLayoutWidgetType,
  STANDARD_OBJECTS,
} from '@saasly/database';
import { FieldMetadataType, type PageLayoutDto, type SavePageLayoutRequest } from '@saasly/shared';
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

/** Objects that ARE the activity plumbing — they don't get Timeline/Notes/Tasks/Files tabs. */
const ACTIVITY_PLUMBING_SINGULARS = new Set([
  'note_target',
  'task_target',
  'timeline_activity',
  'attachment',
  'workspace_member',
]);

/** Base audit columns present on every table — rendered in RecordSheet's own "System" section, not the FIELDS widget. */
const BASE_SYSTEM_FIELD_NAMES = new Set(['created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by']);

/** The non-FIELDS activity tabs, in default order after Home. */
const ACTIVITY_WIDGETS: { type: PageLayoutWidgetType; title: string; icon: string }[] = [
  { type: PageLayoutWidgetType.TIMELINE, title: 'Timeline', icon: 'Clock' },
  { type: PageLayoutWidgetType.NOTES, title: 'Notes', icon: 'StickyNote' },
  { type: PageLayoutWidgetType.TASKS, title: 'Tasks', icon: 'CheckSquare' },
  { type: PageLayoutWidgetType.FILES, title: 'Files', icon: 'Paperclip' },
];

/** Fields that render inside the FIELDS widget's groups (scalar + forward relations; not reverse
 * relations, morph, files, actor or the base audit fields — those render elsewhere). */
function isFieldsWidgetEligible(f: FieldMetadataEntity): boolean {
  if (!f.isActive) return false;
  if (BASE_SYSTEM_FIELD_NAMES.has(f.name)) return false;
  if (
    f.type === FieldMetadataType.ACTOR ||
    f.type === FieldMetadataType.MORPH_RELATION ||
    f.type === FieldMetadataType.FILES
  ) {
    return false;
  }
  // Only the forward (belongs-to-one) side of a relation is a field; the reverse list is a widget.
  if (f.type === FieldMetadataType.RELATION && f.settings?.relationType !== 'MANY_TO_ONE') return false;
  return true;
}

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
  const [tabs, fields] = await Promise.all([
    tabRepo().find({ where: { workspaceId, pageLayoutId: layout.id }, order: { position: 'ASC' } }),
    fieldRepo().find({ where: { workspaceId, objectMetadataId: layout.objectMetadataId } }),
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
    objectMetadataId: layout.objectMetadataId,
    type: layout.type,
    name: layout.name,
    tabs: tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      icon: tab.icon,
      position: tab.position,
      isVisible: tab.isVisible,
      widgets: widgets
        .filter((w) => w.pageLayoutTabId === tab.id)
        .map((w) => ({
          id: w.id,
          type: w.type,
          title: w.title,
          position: w.position,
          isVisible: w.isVisible,
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

/** Build + persist the default record-page layout for an object (Home + activity tabs). */
async function synthesizeDefaultLayout(
  workspaceId: string,
  object: ObjectMetadataEntity,
): Promise<PageLayoutEntity> {
  const fields = await fieldRepo().find({ where: { workspaceId, objectMetadataId: object.id } });
  const eligible = fields.filter(isFieldsWidgetEligible);
  const fieldByName = new Map(fields.map((f) => [f.name, f]));

  // Default groups: reuse the object's standard seed sections when present, else one "General" group;
  // any eligible field not covered lands in a trailing "Other" group.
  const seedDef = STANDARD_OBJECTS.find((d) => d.nameSingular === object.nameSingular);
  const groups: { label: string; fieldIds: string[] }[] = [];
  const covered = new Set<string>();
  if (seedDef?.sections?.length) {
    for (const section of seedDef.sections) {
      const ids = section.fieldNames
        .map((n) => fieldByName.get(n))
        .filter((f): f is FieldMetadataEntity => !!f && isFieldsWidgetEligible(f))
        .map((f) => {
          covered.add(f.id);
          return f.id;
        });
      if (ids.length) groups.push({ label: section.label, fieldIds: ids });
    }
  }
  const leftover = eligible.filter((f) => !covered.has(f.id)).map((f) => f.id);
  if (!groups.length && leftover.length) {
    groups.push({ label: 'General', fieldIds: leftover });
  } else if (leftover.length) {
    groups.push({ label: 'Other', fieldIds: leftover });
  }
  if (!groups.length) groups.push({ label: 'General', fieldIds: [] });

  const includeActivityTabs = !ACTIVITY_PLUMBING_SINGULARS.has(object.nameSingular);

  try {
    return await dataSource.transaction(async (m) => {
      const layout = await m.getRepository(PageLayoutEntity).save(
        m.getRepository(PageLayoutEntity).create({
          workspaceId,
          objectMetadataId: object.id,
          type: PageLayoutType.RECORD_PAGE,
          name: `${object.labelSingular} Record Page`,
        }),
      );

      // Home tab → FIELDS widget → groups (as page_layout_sections).
      const homeTab = await m.getRepository(PageLayoutTabEntity).save(
        m.getRepository(PageLayoutTabEntity).create({
          workspaceId,
          pageLayoutId: layout.id,
          title: 'Home',
          icon: 'LayoutList',
          position: 0,
          isVisible: true,
        }),
      );
      const fieldsWidget = await m.getRepository(PageLayoutWidgetEntity).save(
        m.getRepository(PageLayoutWidgetEntity).create({
          workspaceId,
          pageLayoutTabId: homeTab.id,
          type: PageLayoutWidgetType.FIELDS,
          title: 'Fields',
          position: 0,
          isVisible: true,
          configuration: {},
        }),
      );
      // Drop any legacy sections then recreate under the widget.
      await m.getRepository(PageLayoutSectionEntity).delete({ workspaceId, objectMetadataId: object.id });
      await m.getRepository(PageLayoutSectionEntity).save(
        groups.map((g, position) =>
          m.getRepository(PageLayoutSectionEntity).create({
            workspaceId,
            objectMetadataId: object.id,
            pageLayoutWidgetId: fieldsWidget.id,
            label: g.label,
            position,
            isVisible: true,
            fieldMetadataIds: g.fieldIds,
          }),
        ),
      );

      if (includeActivityTabs) {
        for (let i = 0; i < ACTIVITY_WIDGETS.length; i++) {
          const w = ACTIVITY_WIDGETS[i]!;
          const tab = await m.getRepository(PageLayoutTabEntity).save(
            m.getRepository(PageLayoutTabEntity).create({
              workspaceId,
              pageLayoutId: layout.id,
              title: w.title,
              icon: w.icon,
              position: i + 1,
              isVisible: true,
            }),
          );
          await m.getRepository(PageLayoutWidgetEntity).save(
            m.getRepository(PageLayoutWidgetEntity).create({
              workspaceId,
              pageLayoutTabId: tab.id,
              type: w.type,
              title: w.title,
              position: 0,
              isVisible: true,
              configuration: {},
            }),
          );
        }
      }

      return layout;
    });
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
  actorUserId: string,
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
            configuration: {},
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
  actorUserId: string,
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
