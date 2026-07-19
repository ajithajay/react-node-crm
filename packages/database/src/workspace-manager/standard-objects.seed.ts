import { FieldMetadataType, RelationOnDeleteAction, RelationType, type FieldMetadataSettings, type FieldMetadataType as FMT } from '@saasly/shared';

export interface StandardFieldDef {
  name: string;
  label: string;
  type: FMT;
  icon?: string;
  isNullable?: boolean;
  isUnique?: boolean;
  settings?: FieldMetadataSettings;
}

export interface StandardObjectDef {
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  icon: string;
  description: string;
  /** The scalar field whose value is the record's display label (record-label identifier). */
  labelField?: string;
  fields: StandardFieldDef[];
  /** Default named record-page sections, by field name. Optional — objects with
   * none get a single implicit "General" section at render time. */
  sections?: { label: string; fieldNames: string[] }[];
  /** Forward (MANY_TO_ONE) relation field names promoted to their own FIELD widget on the record
   * page instead of being inlined in a FIELDS-widget section (e.g. Person's
   * `company`, Opportunity's `company`/`point_of_contact`/`owner`). Order here is the widget order. */
  widgetRelationFields?: string[];
  /** Which activity tabs to seed on the record page; defaults to all four when omitted. Task/Note
   * override this — a task/note doesn't have its own sub-notes/sub-tasks. */
  activityWidgetTypes?: ('TIMELINE' | 'NOTES' | 'TASKS' | 'FILES')[];
  /** A RICH_TEXT field excluded from the Fields groups and instead surfaced as a dedicated "Note"
   * tab (full-document editor, no icon/label) — used for Task/Note's body. */
  richTextTabField?: string;
}

/** A regular (single-target) relation seeded between two standard objects. */
export interface StandardRelationDef {
  /** The object the relation is authored on. */
  source: string;
  target: string;
  /** From the source's perspective. MANY_TO_ONE = source belongs to one target (FK on source). */
  relationType: RelationType;
  forwardName: string;
  forwardLabel: string;
  forwardIcon?: string;
  reverseName: string;
  reverseLabel: string;
  reverseIcon?: string;
  onDelete: RelationOnDeleteAction;
}

/** A polymorphic relation: the source belongs to one of several targets; each target gets a reverse list. */
export interface StandardMorphRelationDef {
  source: string;
  targets: string[];
  forwardName: string;
  forwardLabel: string;
  forwardIcon?: string;
  reverseName: string;
  reverseLabel: string;
  reverseIcon?: string;
  onDelete: RelationOnDeleteAction;
}

/**
 * Standard objects seeded into every new workspace. Split into three passes because relations
 * reference other objects' ids:
 *   1. objects + their scalar fields (below),
 *   2. STANDARD_RELATIONS (regular to-one/to-many),
 *   3. STANDARD_MORPH_RELATIONS (polymorphic activity/attachment links).
 * The activity-link junction objects (note/task targets, attachments, timeline activities) and the
 * workspace-member object exist so Company/Person/Opportunity carry the expected relation fields;
 * record UIs to populate them arrive in Phase 6+.
 */
export const STANDARD_OBJECTS: StandardObjectDef[] = [
  {
    nameSingular: 'company',
    namePlural: 'companies',
    labelSingular: 'Company',
    labelPlural: 'Companies',
    icon: 'Building2',
    description: 'Organizations you do business with.',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Name', type: FieldMetadataType.TEXT, icon: 'CaseSensitive', isNullable: false },
      { name: 'domain_name', label: 'Domain Name', type: FieldMetadataType.LINKS, icon: 'Link' },
      { name: 'address', label: 'Address', type: FieldMetadataType.ADDRESS, icon: 'MapPin' },
      { name: 'linkedin', label: 'Linkedin', type: FieldMetadataType.LINKS, icon: 'Linkedin' },
      { name: 'annual_revenue', label: 'Annual Revenue', type: FieldMetadataType.CURRENCY, icon: 'DollarSign' },
    ],
    sections: [
      { label: 'General', fieldNames: ['name', 'domain_name', 'linkedin'] },
      { label: 'Business', fieldNames: ['annual_revenue'] },
      { label: 'Contact', fieldNames: ['address'] },
    ],
  },
  {
    nameSingular: 'person',
    namePlural: 'people',
    labelSingular: 'Person',
    labelPlural: 'People',
    icon: 'User',
    description: 'Individual contacts.',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Name', type: FieldMetadataType.FULL_NAME, icon: 'User' },
      { name: 'emails', label: 'Emails', type: FieldMetadataType.EMAILS, icon: 'Mail' },
      { name: 'phones', label: 'Phones', type: FieldMetadataType.PHONES, icon: 'Phone' },
      { name: 'job_title', label: 'Job Title', type: FieldMetadataType.TEXT, icon: 'Briefcase' },
      { name: 'linkedin', label: 'Linkedin', type: FieldMetadataType.LINKS, icon: 'Linkedin' },
      { name: 'city', label: 'City', type: FieldMetadataType.TEXT, icon: 'MapPin' },
    ],
    sections: [
      { label: 'General', fieldNames: ['name'] },
      { label: 'Work', fieldNames: ['job_title'] },
      { label: 'Social', fieldNames: ['emails', 'phones', 'linkedin', 'city'] },
    ],
    widgetRelationFields: ['company'],
  },
  {
    nameSingular: 'opportunity',
    namePlural: 'opportunities',
    labelSingular: 'Opportunity',
    labelPlural: 'Opportunities',
    icon: 'Target',
    description: 'Sales deals in progress.',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Name', type: FieldMetadataType.TEXT, icon: 'CaseSensitive', isNullable: false },
      { name: 'amount', label: 'Amount', type: FieldMetadataType.CURRENCY, icon: 'DollarSign' },
      { name: 'close_date', label: 'Close Date', type: FieldMetadataType.DATE, icon: 'Calendar' },
      {
        name: 'stage',
        label: 'Stage',
        type: FieldMetadataType.SELECT,
        icon: 'Tag',
        settings: {
          options: [
            { value: 'NEW', label: 'New', color: 'blue', position: 0 },
            { value: 'SCREENING', label: 'Screening', color: 'yellow', position: 1 },
            { value: 'MEETING', label: 'Meeting', color: 'orange', position: 2 },
            { value: 'PROPOSAL', label: 'Proposal', color: 'purple', position: 3 },
            { value: 'CUSTOMER', label: 'Customer', color: 'green', position: 4 },
          ],
        },
      },
    ],
    sections: [
      { label: 'General', fieldNames: ['name'] },
      { label: 'Deal', fieldNames: ['amount', 'stage', 'close_date'] },
    ],
    widgetRelationFields: ['company', 'point_of_contact', 'owner'],
  },
  {
    nameSingular: 'task',
    namePlural: 'tasks',
    labelSingular: 'Task',
    labelPlural: 'Tasks',
    icon: 'CheckSquare',
    description: 'To-dos.',
    labelField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: FieldMetadataType.TEXT, icon: 'CaseSensitive', isNullable: false },
      { name: 'body', label: 'Body', type: FieldMetadataType.RICH_TEXT, icon: 'AlignLeft' },
      {
        name: 'status',
        label: 'Status',
        type: FieldMetadataType.SELECT,
        icon: 'Tag',
        settings: {
          options: [
            { value: 'TODO', label: 'To Do', color: 'gray', position: 0 },
            { value: 'IN_PROGRESS', label: 'In Progress', color: 'yellow', position: 1 },
            { value: 'DONE', label: 'Done', color: 'green', position: 2 },
          ],
        },
      },
      { name: 'due_at', label: 'Due At', type: FieldMetadataType.DATE_TIME, icon: 'CalendarClock' },
    ],
    activityWidgetTypes: ['TIMELINE', 'FILES'],
    richTextTabField: 'body',
  },
  {
    nameSingular: 'note',
    namePlural: 'notes',
    labelSingular: 'Note',
    labelPlural: 'Notes',
    icon: 'StickyNote',
    description: 'Free-form notes.',
    labelField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: FieldMetadataType.TEXT, icon: 'CaseSensitive', isNullable: false },
      { name: 'body', label: 'Body', type: FieldMetadataType.RICH_TEXT, icon: 'AlignLeft' },
    ],
    activityWidgetTypes: ['TIMELINE', 'FILES'],
    richTextTabField: 'body',
  },
  {
    nameSingular: 'workspace_member',
    namePlural: 'workspace_members',
    labelSingular: 'Workspace Member',
    labelPlural: 'Workspace Members',
    icon: 'UserRound',
    description: 'People with access to this workspace.',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Name', type: FieldMetadataType.FULL_NAME, icon: 'User' },
      { name: 'email', label: 'Email', type: FieldMetadataType.TEXT, icon: 'Mail' },
    ],
  },
  {
    nameSingular: 'attachment',
    namePlural: 'attachments',
    labelSingular: 'Attachment',
    labelPlural: 'Attachments',
    icon: 'Paperclip',
    description: 'Files attached to records.',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Name', type: FieldMetadataType.TEXT, icon: 'CaseSensitive' },
      { name: 'full_path', label: 'Full path', type: FieldMetadataType.TEXT, icon: 'Link' },
      { name: 'type', label: 'Type', type: FieldMetadataType.TEXT, icon: 'Tag' },
    ],
  },
  {
    nameSingular: 'note_target',
    namePlural: 'note_targets',
    labelSingular: 'Note Target',
    labelPlural: 'Note Targets',
    icon: 'StickyNote',
    description: 'Links a note to the records it is about.',
    fields: [],
  },
  {
    nameSingular: 'task_target',
    namePlural: 'task_targets',
    labelSingular: 'Task Target',
    labelPlural: 'Task Targets',
    icon: 'CheckSquare',
    description: 'Links a task to the records it is about.',
    fields: [],
  },
  {
    // A dashboard record just holds a title + a pointer to its DASHBOARD-type page_layout
    // (the widget/tab tree lives in the page_layout* tables, not on this object). It's
    // deliberately excluded from the record-page-layout seed pass (Phase 7 dashboards render via
    // their own page_layout, not a record page) — see `PAGE_LAYOUT_EXCLUDED_SINGULARS` in
    // `workspace-manager.service.ts`.
    nameSingular: 'dashboard',
    namePlural: 'dashboards',
    labelSingular: 'Dashboard',
    labelPlural: 'Dashboards',
    icon: 'LayoutDashboard',
    description: 'A page layout of chart, view, iframe, and rich-text widgets.',
    labelField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: FieldMetadataType.TEXT, icon: 'CaseSensitive', isNullable: false },
      { name: 'page_layout_id', label: 'Page Layout', type: FieldMetadataType.UUID, icon: 'LayoutGrid' },
    ],
  },
  {
    nameSingular: 'timeline_activity',
    namePlural: 'timeline_activities',
    labelSingular: 'Timeline Activity',
    labelPlural: 'Timeline Activities',
    icon: 'Activity',
    description: 'Automatic activity log entries.',
    labelField: 'name',
    fields: [
      { name: 'name', label: 'Event', type: FieldMetadataType.TEXT, icon: 'CaseSensitive' },
      { name: 'happens_at', label: 'Happens at', type: FieldMetadataType.DATE_TIME, icon: 'CalendarClock' },
      { name: 'properties', label: 'Properties', type: FieldMetadataType.RAW_JSON, icon: 'Braces' },
    ],
  },
];

export const STANDARD_RELATIONS: StandardRelationDef[] = [
  {
    source: 'person',
    target: 'company',
    relationType: RelationType.MANY_TO_ONE,
    forwardName: 'company',
    forwardLabel: 'Company',
    forwardIcon: 'Building2',
    reverseName: 'people',
    reverseLabel: 'People',
    reverseIcon: 'User',
    onDelete: RelationOnDeleteAction.SET_NULL,
  },
  {
    source: 'opportunity',
    target: 'company',
    relationType: RelationType.MANY_TO_ONE,
    forwardName: 'company',
    forwardLabel: 'Company',
    forwardIcon: 'Building2',
    reverseName: 'opportunities',
    reverseLabel: 'Opportunities',
    reverseIcon: 'Target',
    onDelete: RelationOnDeleteAction.SET_NULL,
  },
  {
    source: 'opportunity',
    target: 'person',
    relationType: RelationType.MANY_TO_ONE,
    forwardName: 'point_of_contact',
    forwardLabel: 'Point of Contact',
    forwardIcon: 'User',
    reverseName: 'opportunities',
    reverseLabel: 'Opportunities',
    reverseIcon: 'Target',
    onDelete: RelationOnDeleteAction.SET_NULL,
  },
  {
    source: 'company',
    target: 'workspace_member',
    relationType: RelationType.MANY_TO_ONE,
    forwardName: 'account_owner',
    forwardLabel: 'Account Owner',
    forwardIcon: 'UserRound',
    reverseName: 'account_owner_for_companies',
    reverseLabel: 'Companies',
    reverseIcon: 'Building2',
    onDelete: RelationOnDeleteAction.SET_NULL,
  },
  {
    source: 'opportunity',
    target: 'workspace_member',
    relationType: RelationType.MANY_TO_ONE,
    forwardName: 'owner',
    forwardLabel: 'Owner',
    forwardIcon: 'UserRound',
    reverseName: 'owner_for_opportunities',
    reverseLabel: 'Opportunities',
    reverseIcon: 'Target',
    onDelete: RelationOnDeleteAction.SET_NULL,
  },
  {
    source: 'note_target',
    target: 'note',
    relationType: RelationType.MANY_TO_ONE,
    forwardName: 'note',
    forwardLabel: 'Note',
    forwardIcon: 'StickyNote',
    reverseName: 'note_targets',
    reverseLabel: 'Note Targets',
    reverseIcon: 'StickyNote',
    onDelete: RelationOnDeleteAction.CASCADE,
  },
  {
    source: 'task_target',
    target: 'task',
    relationType: RelationType.MANY_TO_ONE,
    forwardName: 'task',
    forwardLabel: 'Task',
    forwardIcon: 'CheckSquare',
    reverseName: 'task_targets',
    reverseLabel: 'Task Targets',
    reverseIcon: 'CheckSquare',
    onDelete: RelationOnDeleteAction.CASCADE,
  },
];

/** The three record types that notes/tasks/attachments/timeline activities can point at. */
const MORPH_TARGETS = ['company', 'person', 'opportunity'];

/**
 * Default TABLE-view column order/visibility per standard object. Seeded as
 * `ViewFieldEntity` rows on workspace provisioning so the default "All X" view starts curated
 * instead of showing every column unsorted. Fields not listed here fall back to the
 * synthesize-on-read behavior in `view.service.ts` (shown, in DB order) — used for objects below
 * that intentionally have no curated list (junction/system objects) and for any custom object.
 */
export const STANDARD_TABLE_VIEW_FIELDS: Record<string, { name: string; size?: number; hidden?: boolean }[]> = {
  company: [
    { name: 'name', size: 180 },
    { name: 'domain_name', size: 170 },
    { name: 'created_by', size: 150 },
    { name: 'account_owner', size: 150 },
    { name: 'created_at', size: 150 },
    { name: 'linkedin', size: 170 },
    { name: 'address', size: 170 },
    { name: 'updated_at', hidden: true },
    { name: 'updated_by', hidden: true },
  ],
  person: [
    { name: 'name', size: 180 },
    { name: 'company', size: 150 },
    { name: 'emails', size: 170 },
    { name: 'job_title', size: 150 },
    { name: 'phones', size: 150 },
    { name: 'created_by', size: 150 },
    { name: 'created_at', size: 150 },
    { name: 'linkedin', size: 170 },
    { name: 'city', size: 150 },
    { name: 'updated_at', hidden: true },
    { name: 'updated_by', hidden: true },
  ],
  opportunity: [
    { name: 'name', size: 180 },
    { name: 'amount', size: 150 },
    { name: 'stage', size: 150 },
    { name: 'company', size: 150 },
    { name: 'point_of_contact', size: 150 },
    { name: 'close_date', size: 150 },
    { name: 'created_by', size: 150 },
    { name: 'created_at', size: 150 },
    { name: 'updated_at', hidden: true },
    { name: 'updated_by', hidden: true },
  ],
  task: [
    { name: 'title', size: 180 },
    { name: 'status', size: 150 },
    { name: 'due_at', size: 150 },
    { name: 'created_by', size: 150 },
    { name: 'created_at', size: 150 },
    { name: 'body', hidden: true },
    { name: 'updated_at', hidden: true },
    { name: 'updated_by', hidden: true },
  ],
  note: [
    { name: 'title', size: 180 },
    { name: 'created_by', size: 150 },
    { name: 'created_at', size: 150 },
    { name: 'body', hidden: true },
    { name: 'updated_at', hidden: true },
    { name: 'updated_by', hidden: true },
  ],
};

export const STANDARD_MORPH_RELATIONS: StandardMorphRelationDef[] = [
  {
    source: 'note_target',
    targets: MORPH_TARGETS,
    forwardName: 'target',
    forwardLabel: 'Target',
    forwardIcon: 'Crosshair',
    reverseName: 'note_targets',
    reverseLabel: 'Note Targets',
    reverseIcon: 'StickyNote',
    onDelete: RelationOnDeleteAction.CASCADE,
  },
  {
    source: 'task_target',
    targets: MORPH_TARGETS,
    forwardName: 'target',
    forwardLabel: 'Target',
    forwardIcon: 'Crosshair',
    reverseName: 'task_targets',
    reverseLabel: 'Task Targets',
    reverseIcon: 'CheckSquare',
    onDelete: RelationOnDeleteAction.CASCADE,
  },
  {
    source: 'attachment',
    targets: MORPH_TARGETS,
    forwardName: 'target',
    forwardLabel: 'Target',
    forwardIcon: 'Crosshair',
    reverseName: 'attachments',
    reverseLabel: 'Attachments',
    reverseIcon: 'Paperclip',
    onDelete: RelationOnDeleteAction.CASCADE,
  },
  {
    source: 'timeline_activity',
    // Task/Note get their own Timeline tab populated too — unlike note_target/task_target/
    // attachment, whose targets stay Company/Person/Opportunity only (a Task shouldn't be "about" another Task).
    targets: [...MORPH_TARGETS, 'task', 'note'],
    forwardName: 'target',
    forwardLabel: 'Target',
    forwardIcon: 'Crosshair',
    reverseName: 'timeline_activities',
    reverseLabel: 'Timeline Activities',
    reverseIcon: 'Activity',
    onDelete: RelationOnDeleteAction.CASCADE,
  },
];
