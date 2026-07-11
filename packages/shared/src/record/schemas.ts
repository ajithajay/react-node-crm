import { z } from 'zod';
import { ViewFilterOperand, ViewSortDirection } from '../metadata/view-type.js';

const operandValues = Object.values(ViewFilterOperand) as [string, ...string[]];
const directionValues = Object.values(ViewSortDirection) as [string, ...string[]];

/**
 * A single filter condition, `{ field, operand, value }`. v1 supports a flat list of conditions
 * ANDed together — nested AND/OR groups (BRD §4 "advanced filters") are deferred; see task-list.md.
 */
export const recordFilterConditionSchema = z.object({
  field: z.string().min(1),
  operand: z.enum(operandValues),
  value: z.unknown().optional(),
});
export type RecordFilterCondition = z.infer<typeof recordFilterConditionSchema>;

export const recordFilterSchema = z.array(recordFilterConditionSchema);
export type RecordFilter = z.infer<typeof recordFilterSchema>;

/**
 * Query params for `GET /rest/:objectNamePlural`. `filter` arrives as a JSON-encoded string (query
 * strings have no native array/object syntax) and is parsed by the query-parser, not here — zod
 * only validates the string shape at this layer to keep the input/output types simple for the
 * `validate` middleware (see apps/api/src/lib/query-parser.ts for the actual JSON.parse + check).
 */
export const recordListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(60),
  search: z.string().trim().min(1).optional(),
  sortField: z.string().min(1).optional(),
  sortDirection: z.enum(directionValues).optional(),
  filter: z.string().optional(),
});
export type RecordListQuery = z.infer<typeof recordListQuerySchema>;
