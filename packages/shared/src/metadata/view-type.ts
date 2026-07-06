/** BRD §4 — v1 supports Table + Kanban; Calendar is v2. */
export const ViewType = {
  TABLE: 'TABLE',
  KANBAN: 'KANBAN',
} as const;
export type ViewType = (typeof ViewType)[keyof typeof ViewType];

export const ViewFilterOperand = {
  IS: 'IS',
  IS_NOT: 'IS_NOT',
  IS_EMPTY: 'IS_EMPTY',
  IS_NOT_EMPTY: 'IS_NOT_EMPTY',
  CONTAINS: 'CONTAINS',
  DOES_NOT_CONTAIN: 'DOES_NOT_CONTAIN',
  LESS_THAN_OR_EQUAL: 'LESS_THAN_OR_EQUAL',
  GREATER_THAN_OR_EQUAL: 'GREATER_THAN_OR_EQUAL',
  IS_BEFORE: 'IS_BEFORE',
  IS_AFTER: 'IS_AFTER',
  IS_RELATIVE: 'IS_RELATIVE',
} as const;
export type ViewFilterOperand = (typeof ViewFilterOperand)[keyof typeof ViewFilterOperand];

export const ViewSortDirection = {
  ASC: 'ASC',
  DESC: 'DESC',
} as const;
export type ViewSortDirection = (typeof ViewSortDirection)[keyof typeof ViewSortDirection];
