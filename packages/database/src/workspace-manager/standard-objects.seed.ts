import { FieldMetadataType, type FieldMetadataSettings, type FieldMetadataType as FMT } from '@saasly/shared';

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
  fields: StandardFieldDef[];
}

/**
 * Standard objects seeded into every new workspace (BRD §3, §4). Kept to a modest core field set —
 * this is our own product, not a 1:1 Twenty clone. Activity-link/junction objects (task/note
 * targets, attachments) and Dashboard/Workflow are deferred to the phases that build those
 * features (6/7/8), since they need relation wiring those phases will design.
 */
export const STANDARD_OBJECTS: StandardObjectDef[] = [
  {
    nameSingular: 'company',
    namePlural: 'companies',
    labelSingular: 'Company',
    labelPlural: 'Companies',
    icon: 'IconBuildingSkyscraper',
    description: 'Organizations you do business with.',
    fields: [
      { name: 'name', label: 'Name', type: FieldMetadataType.TEXT, isNullable: false },
      { name: 'domain_name', label: 'Domain Name', type: FieldMetadataType.LINKS },
      { name: 'address', label: 'Address', type: FieldMetadataType.ADDRESS },
      { name: 'annual_revenue', label: 'Annual Revenue', type: FieldMetadataType.CURRENCY },
      {
        name: 'employees',
        label: 'Employees',
        type: FieldMetadataType.NUMBER,
        settings: { numberDataType: 'INT' },
      },
    ],
  },
  {
    nameSingular: 'person',
    namePlural: 'people',
    labelSingular: 'Person',
    labelPlural: 'People',
    icon: 'IconUser',
    description: 'Individual contacts.',
    fields: [
      { name: 'name', label: 'Name', type: FieldMetadataType.FULL_NAME },
      { name: 'emails', label: 'Emails', type: FieldMetadataType.EMAILS },
      { name: 'phones', label: 'Phones', type: FieldMetadataType.PHONES },
      { name: 'job_title', label: 'Job Title', type: FieldMetadataType.TEXT },
      { name: 'city', label: 'City', type: FieldMetadataType.TEXT },
    ],
  },
  {
    nameSingular: 'opportunity',
    namePlural: 'opportunities',
    labelSingular: 'Opportunity',
    labelPlural: 'Opportunities',
    icon: 'IconTargetArrow',
    description: 'Sales deals in progress.',
    fields: [
      { name: 'name', label: 'Name', type: FieldMetadataType.TEXT, isNullable: false },
      { name: 'amount', label: 'Amount', type: FieldMetadataType.CURRENCY },
      { name: 'close_date', label: 'Close Date', type: FieldMetadataType.DATE },
      {
        name: 'stage',
        label: 'Stage',
        type: FieldMetadataType.SELECT,
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
  },
  {
    nameSingular: 'task',
    namePlural: 'tasks',
    labelSingular: 'Task',
    labelPlural: 'Tasks',
    icon: 'IconCheckbox',
    description: 'To-dos.',
    fields: [
      { name: 'title', label: 'Title', type: FieldMetadataType.TEXT, isNullable: false },
      { name: 'body', label: 'Body', type: FieldMetadataType.RICH_TEXT },
      {
        name: 'status',
        label: 'Status',
        type: FieldMetadataType.SELECT,
        settings: {
          options: [
            { value: 'TODO', label: 'To Do', color: 'gray', position: 0 },
            { value: 'IN_PROGRESS', label: 'In Progress', color: 'yellow', position: 1 },
            { value: 'DONE', label: 'Done', color: 'green', position: 2 },
          ],
        },
      },
      { name: 'due_at', label: 'Due At', type: FieldMetadataType.DATE_TIME },
    ],
  },
  {
    nameSingular: 'note',
    namePlural: 'notes',
    labelSingular: 'Note',
    labelPlural: 'Notes',
    icon: 'IconNotes',
    description: 'Free-form notes.',
    fields: [
      { name: 'title', label: 'Title', type: FieldMetadataType.TEXT, isNullable: false },
      { name: 'body', label: 'Body', type: FieldMetadataType.RICH_TEXT },
    ],
  },
];
