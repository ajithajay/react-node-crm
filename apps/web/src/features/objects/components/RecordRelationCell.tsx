import { useQuery } from '@tanstack/react-query';
import { type DataModelField, dataModelApi, recordApi } from '@/lib/api-client';
import { resolveRecordLabel } from '../lib/field-values';
import { RecordChip } from './RecordChip';

/**
 * Read-only table cell for a forward (MANY_TO_ONE) RELATION — e.g. Company's Account Owner. Resolves
 * the target record's real label (name → email → "Unnamed …", never a raw id) instead of showing a
 * truncated UUID (gap A2/B). Relies on TanStack Query caching so rows sharing the same target id
 * (e.g. many companies with the same owner) resolve from a single fetch.
 */
export function RecordRelationCell({ field, id }: { field: DataModelField; id: string }) {
  const targetObjectId = field.settings?.relationTargetObjectMetadataId as string | undefined;

  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const targetObject = objects?.find((o) => o.id === targetObjectId);

  const { data: targetDetail } = useQuery({
    queryKey: ['data-model-object', targetObjectId],
    queryFn: () => dataModelApi.getObject(targetObjectId!),
    enabled: !!targetObjectId,
  });

  const { data: record } = useQuery({
    queryKey: ['relation-cell', targetObject?.namePlural, id],
    queryFn: () => recordApi.get(targetObject!.namePlural, id),
    enabled: !!targetObject,
  });

  if (!targetObject) return <span className="truncate text-muted-foreground">{id.slice(0, 8)}</span>;
  if (!record) return <span className="text-muted-foreground">…</span>;

  const labelField = targetDetail?.fields.find((f) => f.id === targetDetail.object.labelIdentifierFieldMetadataId);
  return <RecordChip name={resolveRecordLabel(record, labelField, targetDetail?.fields, targetObject.labelSingular)} />;
}
