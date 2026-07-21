import type { EntityManager } from 'typeorm';
import { FieldMetadataType } from '@saasly/shared';
import { FieldMetadataEntity } from '../entities/field-metadata.entity.js';
import { ObjectMetadataEntity } from '../entities/object-metadata.entity.js';
import { PageLayoutEntity, PageLayoutType } from '../entities/page-layout.entity.js';
import { PageLayoutSectionEntity } from '../entities/page-layout-section.entity.js';
import { PageLayoutTabEntity } from '../entities/page-layout-tab.entity.js';
import { PageLayoutWidgetEntity, PageLayoutWidgetType } from '../entities/page-layout-widget.entity.js';
import { STANDARD_OBJECTS } from './standard-objects.seed.js';

/**
 * Default record-page layout builder. The record page is 100% widget-driven:
 *   - Home tab → a FIELDS widget whose groups (page_layout_sections) hold scalar + forward-relation
 *     fields plus a dedicated "System" group for the audit fields — and one FIELD widget per
 *     collection/reverse relation (e.g. People, Opportunities), rendered after the FIELDS widget.
 *   - Timeline / Notes / Tasks / Files → one activity widget each, on its own tab.
 * Seeded at workspace provisioning and on custom-object creation (not lazily), so every object has a
 * real, editable default layout the moment its record page opens.
 */

/** The base audit columns on every workspace table. `deleted_at` is intentionally NOT shown on the
 * record page; the other four form the System group. */
const SYSTEM_GROUP_FIELD_NAMES = ['created_at', 'created_by', 'updated_at', 'updated_by'] as const;
/** Which System-group fields are visible by default (created shown, updated hidden). */
const SYSTEM_GROUP_VISIBLE = new Set<string>(['created_at', 'created_by']);
const BASE_SYSTEM_FIELD_NAMES = new Set(['created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by']);

/** Objects that ARE the activity plumbing — they don't get Timeline/Notes/Tasks/Files tabs. */
const ACTIVITY_PLUMBING_SINGULARS = new Set([
  'note_target',
  'task_target',
  'timeline_activity',
  'attachment',
  'workspace_member',
  // Messaging & calendar objects: viewable as records but drive the Emails/Calendar widgets,
  // so they don't get their own Timeline/Notes/Tasks/Files tabs.
  'message',
  'message_thread',
  'message_participant',
  'message_channel_message_association',
  'calendar_event',
  'calendar_event_participant',
  'calendar_channel_event_association',
]);

type ActivityWidgetKey = 'TIMELINE' | 'NOTES' | 'TASKS' | 'FILES' | 'EMAILS' | 'CALENDAR';
const ACTIVITY_WIDGET_DEFS: Record<ActivityWidgetKey, { type: PageLayoutWidgetType; title: string; icon: string }> = {
  TIMELINE: { type: PageLayoutWidgetType.TIMELINE, title: 'Timeline', icon: 'Clock' },
  NOTES: { type: PageLayoutWidgetType.NOTES, title: 'Notes', icon: 'StickyNote' },
  TASKS: { type: PageLayoutWidgetType.TASKS, title: 'Tasks', icon: 'CheckSquare' },
  FILES: { type: PageLayoutWidgetType.FILES, title: 'Files', icon: 'Paperclip' },
  EMAILS: { type: PageLayoutWidgetType.EMAILS, title: 'Emails', icon: 'Mail' },
  CALENDAR: { type: PageLayoutWidgetType.CALENDAR, title: 'Calendar', icon: 'CalendarClock' },
};
const DEFAULT_ACTIVITY_WIDGET_TYPES: ActivityWidgetKey[] = ['TIMELINE', 'NOTES', 'TASKS', 'FILES'];

const DEFAULT_FIELDS_WIDGET_CONFIG = { showMoreFieldsButton: false, autoVisibleNewFields: true };

/** Scalar or forward (belongs-to-one) relation field — a member of a FIELDS-widget business group. */
export function isFieldsGroupEligible(f: FieldMetadataEntity): boolean {
  if (!f.isActive) return false;
  if (BASE_SYSTEM_FIELD_NAMES.has(f.name)) return false;
  if (
    f.type === FieldMetadataType.ACTOR ||
    f.type === FieldMetadataType.MORPH_RELATION ||
    f.type === FieldMetadataType.FILES
  ) {
    return false;
  }
  if (f.type === FieldMetadataType.RELATION && f.settings?.relationType !== 'MANY_TO_ONE') return false;
  return true;
}

/** A collection relation that renders as its own FIELD widget (People, Opportunities, …). */
export function isReverseRelationWidgetField(f: FieldMetadataEntity): boolean {
  return (
    f.isActive &&
    f.type === FieldMetadataType.RELATION &&
    f.settings?.relationType === 'ONE_TO_MANY' &&
    !f.settings?.isMorphReverse
  );
}

export interface DefaultGroup {
  label: string;
  isVisible: boolean;
  fieldIds: string[];
}

/**
 * Compute the FIELDS widget's default groups for an object: its seeded business sections (or a
 * single "General" for custom objects) + a trailing "System" group. Shared by provisioning, the
 * per-widget reset, and the lazy fallback so all three stay identical.
 */
export function computeFieldsWidgetGroups(object: ObjectMetadataEntity, fields: FieldMetadataEntity[]): DefaultGroup[] {
  const fieldByName = new Map(fields.map((f) => [f.name, f]));
  const seedDef = STANDARD_OBJECTS.find((d) => d.nameSingular === object.nameSingular);
  const widgetRelationNames = new Set(seedDef?.widgetRelationFields ?? []);
  const excludedNames = new Set([...widgetRelationNames, ...(seedDef?.richTextTabField ? [seedDef.richTextTabField] : [])]);
  const eligible = fields.filter((f) => isFieldsGroupEligible(f) && !excludedNames.has(f.name));

  const groups: DefaultGroup[] = [];
  const covered = new Set<string>();
  if (seedDef?.sections?.length) {
    for (const section of seedDef.sections) {
      const ids = section.fieldNames
        .map((n) => fieldByName.get(n))
        .filter((f): f is FieldMetadataEntity => !!f && isFieldsGroupEligible(f) && !excludedNames.has(f.name))
        .map((f) => {
          covered.add(f.id);
          return f.id;
        });
      if (ids.length) groups.push({ label: section.label, isVisible: true, fieldIds: ids });
    }
  }
  const leftover = eligible.filter((f) => !covered.has(f.id)).map((f) => f.id);
  if (!groups.length && leftover.length) {
    groups.push({ label: 'General', isVisible: true, fieldIds: leftover });
  } else if (leftover.length) {
    groups.push({ label: 'Other', isVisible: true, fieldIds: leftover });
  }
  if (!groups.length) groups.push({ label: 'General', isVisible: true, fieldIds: [] });

  // System group — the audit fields, always last.
  const systemIds = SYSTEM_GROUP_FIELD_NAMES.map((n) => fieldByName.get(n))
    .filter((f): f is FieldMetadataEntity => !!f)
    .map((f) => f.id);
  if (systemIds.length) groups.push({ label: 'System', isVisible: true, fieldIds: systemIds });

  return groups;
}

/** Persist a computed group set as page_layout_sections under a FIELDS widget, and apply the default
 * per-field record-page visibility (System's updated_at/updated_by hidden). */
export async function writeFieldsWidgetGroups(
  manager: EntityManager,
  workspaceId: string,
  objectMetadataId: string,
  widgetId: string,
  groups: DefaultGroup[],
  fields: FieldMetadataEntity[],
): Promise<void> {
  const fieldByName = new Map(fields.map((f) => [f.id, f.name]));
  await manager.getRepository(PageLayoutSectionEntity).delete({ workspaceId, pageLayoutWidgetId: widgetId });
  await manager.getRepository(PageLayoutSectionEntity).save(
    groups.map((g, position) =>
      manager.getRepository(PageLayoutSectionEntity).create({
        workspaceId,
        objectMetadataId,
        pageLayoutWidgetId: widgetId,
        label: g.label,
        position,
        isVisible: g.isVisible,
        fieldMetadataIds: g.fieldIds,
      }),
    ),
  );

  // Default visibility: everything visible except the System group's updated_* fields.
  for (const g of groups) {
    for (const fid of g.fieldIds) {
      const name = fieldByName.get(fid);
      const visible = g.label === 'System' ? (name ? SYSTEM_GROUP_VISIBLE.has(name) : true) : true;
      await manager.getRepository(FieldMetadataEntity).update({ id: fid, workspaceId }, { isVisibleInRecordPage: visible });
    }
  }
}

/**
 * Build + persist the default record-page layout for one object using the given EntityManager
 * (so it enrolls in the caller's transaction). Assumes the object's fields + relations already exist.
 */
export async function seedPageLayoutForObject(
  manager: EntityManager,
  workspaceId: string,
  object: ObjectMetadataEntity,
): Promise<PageLayoutEntity> {
  const fields = await manager.getRepository(FieldMetadataEntity).find({ where: { workspaceId, objectMetadataId: object.id } });
  const groups = computeFieldsWidgetGroups(object, fields);
  const seedDef = STANDARD_OBJECTS.find((d) => d.nameSingular === object.nameSingular);
  const fieldByName = new Map(fields.map((f) => [f.name, f]));
  // Forward (MANY_TO_ONE) relations promoted to their own widget (e.g. Person's
  // Company, Opportunity's Company/Point of Contact/Owner), in the object def's declared order,
  // followed by the reverse/collection relation widgets (People, Opportunities, …).
  const forwardRelationWidgets = (seedDef?.widgetRelationFields ?? [])
    .map((n) => fieldByName.get(n))
    .filter((f): f is FieldMetadataEntity => !!f);
  // Reverse relations pointing at a junction/activity-plumbing object (e.g. Task's own
  // `task_targets` — the plain FK reverse of task_target.task) are internal wiring, not a
  // meaningful "collection" to show on the record page; only the morph-reverse side (already
  // excluded above) resolves to real Company/Person/Opportunity records worth displaying.
  const objectsById = new Map(
    (await manager.getRepository(ObjectMetadataEntity).find({ where: { workspaceId } })).map((o) => [o.id, o]),
  );
  const reverseRelations = fields.filter(isReverseRelationWidgetField).filter((f) => {
    const targetId = f.settings?.relationTargetObjectMetadataId as string | undefined;
    const targetObject = targetId ? objectsById.get(targetId) : undefined;
    return !targetObject || !ACTIVITY_PLUMBING_SINGULARS.has(targetObject.nameSingular);
  });
  const relationWidgets = [...forwardRelationWidgets, ...reverseRelations];
  const includeActivityTabs = !ACTIVITY_PLUMBING_SINGULARS.has(object.nameSingular);
  const activityTypes = seedDef?.activityWidgetTypes ?? DEFAULT_ACTIVITY_WIDGET_TYPES;

  const layout = await manager.getRepository(PageLayoutEntity).save(
    manager.getRepository(PageLayoutEntity).create({
      workspaceId,
      objectMetadataId: object.id,
      type: PageLayoutType.RECORD_PAGE,
      name: `${object.labelSingular} Record Page`,
    }),
  );

  const homeTab = await manager.getRepository(PageLayoutTabEntity).save(
    manager.getRepository(PageLayoutTabEntity).create({
      workspaceId,
      pageLayoutId: layout.id,
      title: 'Home',
      icon: 'LayoutList',
      position: 0,
      isVisible: true,
      isPinned: true,
    }),
  );

  // Widget 0 — the FIELDS widget (scalar/forward-relation groups + System group).
  const fieldsWidget = await manager.getRepository(PageLayoutWidgetEntity).save(
    manager.getRepository(PageLayoutWidgetEntity).create({
      workspaceId,
      pageLayoutTabId: homeTab.id,
      type: PageLayoutWidgetType.FIELDS,
      title: 'Fields',
      position: 0,
      isVisible: true,
      configuration: DEFAULT_FIELDS_WIDGET_CONFIG,
    }),
  );
  await writeFieldsWidgetGroups(manager, workspaceId, object.id, fieldsWidget.id, groups, fields);

  // Widgets 1..n — one FIELD widget per forward/reverse relation (Company, People, Opportunities, …).
  for (let i = 0; i < relationWidgets.length; i++) {
    const rel = relationWidgets[i]!;
    await manager.getRepository(PageLayoutWidgetEntity).save(
      manager.getRepository(PageLayoutWidgetEntity).create({
        workspaceId,
        pageLayoutTabId: homeTab.id,
        type: PageLayoutWidgetType.FIELD,
        title: rel.label,
        position: i + 1,
        isVisible: true,
        configuration: { fieldMetadataId: rel.id, displayMode: 'CARD' },
      }),
    );
  }

  // "Note" tab — a Task/Note's rich-text body as a dedicated full-document tab, before the activity
  // tabs (Note, Timeline, Files).
  let nextTabPosition = 1;
  const richTextField = seedDef?.richTextTabField ? fieldByName.get(seedDef.richTextTabField) : undefined;
  if (richTextField) {
    const noteTab = await manager.getRepository(PageLayoutTabEntity).save(
      manager.getRepository(PageLayoutTabEntity).create({
        workspaceId,
        pageLayoutId: layout.id,
        title: 'Note',
        icon: 'FileText',
        position: nextTabPosition,
        isVisible: true,
        isPinned: false,
      }),
    );
    await manager.getRepository(PageLayoutWidgetEntity).save(
      manager.getRepository(PageLayoutWidgetEntity).create({
        workspaceId,
        pageLayoutTabId: noteTab.id,
        type: PageLayoutWidgetType.FIELD,
        title: 'Note',
        position: 0,
        isVisible: true,
        configuration: { fieldMetadataId: richTextField.id, displayMode: 'DOCUMENT' },
      }),
    );
    nextTabPosition += 1;
  }

  // Activity tabs.
  if (includeActivityTabs) {
    for (let i = 0; i < activityTypes.length; i++) {
      const w = ACTIVITY_WIDGET_DEFS[activityTypes[i]!];
      const tab = await manager.getRepository(PageLayoutTabEntity).save(
        manager.getRepository(PageLayoutTabEntity).create({
          workspaceId,
          pageLayoutId: layout.id,
          title: w.title,
          icon: w.icon,
          position: nextTabPosition + i,
          isVisible: true,
          isPinned: false,
        }),
      );
      await manager.getRepository(PageLayoutWidgetEntity).save(
        manager.getRepository(PageLayoutWidgetEntity).create({
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
}
