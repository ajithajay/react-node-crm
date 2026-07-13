import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { dataModelApi, recordApi, type DashboardWidgetConfiguration, type DataModelField } from '@/lib/api-client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { friendlyFieldKey } from '@/features/objects/lib/field-values';
import { RecordTableCellDisplay } from '@/features/objects/components/RecordTableCellDisplay';
import { TABLE_ROW_HEIGHT } from '@/features/objects/lib/table-tokens';
import { WidgetEmptyState, WidgetLoading } from './WidgetStates';

export const DISPLAYABLE_TYPES = new Set([
  'TEXT',
  'NUMBER',
  'BOOLEAN',
  'SELECT',
  'MULTI_SELECT',
  'DATE',
  'DATE_TIME',
  'RATING',
  'FULL_NAME',
  'CURRENCY',
  'RELATION',
]);

/** A field the View widget can show as a column — same rule the config panel's field-picker and the
 * rendered table both use, so the picker never offers a field the table can't actually render (a
 * ONE_TO_MANY relation has no single value to show in a cell). */
export function isDisplayableField(f: DataModelField): boolean {
  return DISPLAYABLE_TYPES.has(f.type) && !(f.type === 'RELATION' && f.settings?.relationType === 'ONE_TO_MANY');
}

/** The "View" widget — an embedded record table for one object: chosen `visibleFieldIds` (falls back
 * to the first 4 displayable fields), a `filter`, an optional single-field `sort`, and `recordLimit`. */
export function RecordTableWidgetView({
  objectMetadataId,
  configuration,
}: {
  objectMetadataId: string | null;
  configuration: DashboardWidgetConfiguration;
}) {
  const navigate = useNavigate();
  const { data: detail, isLoading: loadingObject } = useQuery({
    queryKey: ['data-model-object', objectMetadataId],
    queryFn: () => dataModelApi.getObject(objectMetadataId!),
    enabled: !!objectMetadataId,
  });

  const recordLimit = configuration.recordLimit ?? 10;
  const displayableFields = detail?.fields.filter((f) => f.isActive && f.isRestrictable && isDisplayableField(f)) ?? [];
  const columns = configuration.visibleFieldIds
    ? displayableFields.filter((f) => configuration.visibleFieldIds!.includes(f.id))
    : displayableFields.slice(0, 4);
  const sortField = detail?.fields.find((f) => f.id === configuration.sortFieldMetadataId);

  const { data: listResult, isLoading: loadingRecords } = useQuery({
    queryKey: ['dashboard-record-table', objectMetadataId, recordLimit, configuration.filter, configuration.sortFieldMetadataId, configuration.sortDirection],
    queryFn: () =>
      recordApi.list(detail!.object.namePlural, {
        page: 1,
        pageSize: recordLimit,
        filter: configuration.filter as { field: string; operand: string; value?: unknown }[] | undefined,
        sortField: sortField ? friendlyFieldKey(sortField) : undefined,
        sortDirection: configuration.sortDirection,
      }),
    enabled: !!detail,
  });

  if (!objectMetadataId) return <WidgetEmptyState message="Choose a data source to get started." />;
  if (loadingObject || loadingRecords) return <WidgetLoading />;
  if (!detail || !listResult) return <WidgetEmptyState message="Couldn't load this view." />;
  if (listResult.records.length === 0) return <WidgetEmptyState message={`No ${detail.object.labelPlural.toLowerCase()} yet.`} />;

  const labelIdentifierFieldId = detail.object.labelIdentifierFieldMetadataId;

  return (
    <div className="h-full overflow-auto">
      <Table className="w-fit min-w-full border-separate border-spacing-0">
        <TableHeader>
          <TableRow className="[&_th]:h-8 [&_th]:border-b [&_th]:border-r [&_th]:bg-background [&_th]:py-0">
            {columns.map((c) => (
              <TableHead key={c.id} className="select-none whitespace-nowrap px-2 font-medium">
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="[&_td]:h-8 [&_td]:border-b [&_td]:border-r [&_td]:px-2 [&_td]:py-0 [&_tr:hover]:bg-muted/30">
          {listResult.records.map((record) => (
            <TableRow
              key={record.id as string}
              style={{ height: TABLE_ROW_HEIGHT }}
              className="cursor-pointer"
              onClick={() => navigate(`/objects/${detail.object.namePlural}/${record.id as string}`)}
            >
              {columns.map((c) => (
                <TableCell key={c.id} className="max-w-64 overflow-hidden">
                  <RecordTableCellDisplay field={c} record={record} isLabelIdentifier={labelIdentifierFieldId === c.id} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
