import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dataModelApi, recordApi } from '@/lib/api-client';
import { formatFieldValue } from '../lib/field-values';
import { RecordChip } from './RecordChip';

const TARGET_OBJECT_NAMES = ['company', 'person', 'opportunity'] as const;

/**
 * A Task's/Note's own "Relations" widget (Twenty's `ActivityTargetsInlineCell`) — shows which
 * Company/Person/Opportunity it's about, resolved from the junction object's morph `target`
 * (targetType/targetId), not the raw junction rows themselves.
 */
export function RecordTargetsWidget({
  junctionObjectNamePlural,
  forwardKey,
  sourceRecordId,
}: {
  junctionObjectNamePlural: string;
  forwardKey: string;
  sourceRecordId: string;
}) {
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [targetType, setTargetType] = useState<string>('company');
  const [search, setSearch] = useState('');

  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const objectByName = new Map((objects ?? []).map((o) => [o.nameSingular, o]));

  const junctionsQueryKey = ['record-targets', junctionObjectNamePlural, sourceRecordId];
  const { data: junctions } = useQuery({
    queryKey: junctionsQueryKey,
    queryFn: () =>
      recordApi.list(junctionObjectNamePlural, {
        filter: [{ field: forwardKey, operand: 'IS', value: sourceRecordId }],
        pageSize: 100,
      }),
  });
  const junctionRows = junctions?.records ?? [];

  const targetIdsByType = new Map<string, string[]>();
  for (const row of junctionRows) {
    const type = row.targetType as string | null;
    const id = row.targetId as string | null;
    if (!type || !id) continue;
    targetIdsByType.set(type, [...(targetIdsByType.get(type) ?? []), id]);
  }

  // Fixed-size loops over the 3 known target types — stable across renders, safe to call hooks in.
  const objectDetailQueries = TARGET_OBJECT_NAMES.map((name) => {
    const object = objectByName.get(name);
    return useQuery({
      queryKey: ['data-model-object', object?.id],
      queryFn: () => dataModelApi.getObject(object!.id),
      enabled: !!object,
    });
  });
  const labelFieldByType = new Map(
    TARGET_OBJECT_NAMES.map((name, i) => {
      const detail = objectDetailQueries[i]?.data;
      const labelField = detail?.fields.find((f) => f.id === detail.object.labelIdentifierFieldMetadataId);
      return [name, labelField] as const;
    }),
  );

  const detailQueries = TARGET_OBJECT_NAMES.map((name) => {
    const object = objectByName.get(name);
    const ids = targetIdsByType.get(name) ?? [];
    return useQuery({
      queryKey: ['record-targets-detail', name, ids.join(',')],
      queryFn: () => Promise.all(ids.map((id) => recordApi.get(object!.namePlural, id))),
      enabled: !!object && ids.length > 0,
    });
  });

  const candidateLabelField = labelFieldByType.get(targetType as (typeof TARGET_OBJECT_NAMES)[number]);

  const { data: candidates } = useQuery({
    queryKey: ['record-targets-candidates', targetType, search],
    queryFn: () => recordApi.list(objectByName.get(targetType)!.namePlural, { search: search || undefined, pageSize: 20 }),
    enabled: pickerOpen && !!objectByName.get(targetType),
  });

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: junctionsQueryKey });
  }

  const linkMutation = useMutation({
    mutationFn: (candidateId: string) =>
      recordApi.create(junctionObjectNamePlural, {
        [forwardKey]: sourceRecordId,
        targetType,
        targetId: candidateId,
      }),
    onSuccess: invalidate,
  });

  const unlinkMutation = useMutation({
    mutationFn: (junctionRowId: string) => recordApi.remove(junctionObjectNamePlural, junctionRowId),
    onSuccess: invalidate,
  });

  type Chip = { junctionRowId: string; namePlural: string; recordId: string; label: string };
  const chips: Chip[] = [];
  for (const row of junctionRows) {
    const type = row.targetType as string | null;
    const id = row.targetId as string | null;
    const object = type ? objectByName.get(type) : undefined;
    if (!type || !id || !object) continue;
    const typeIndex = TARGET_OBJECT_NAMES.indexOf(type as (typeof TARGET_OBJECT_NAMES)[number]);
    const detail = typeIndex >= 0 ? detailQueries[typeIndex]?.data?.find((r) => r?.id === id) : undefined;
    const labelField = labelFieldByType.get(type as (typeof TARGET_OBJECT_NAMES)[number]);
    const formatted = detail && labelField ? formatFieldValue(labelField, detail) : undefined;
    chips.push({ junctionRowId: row.id as string, namePlural: object.namePlural, recordId: id, label: formatted && formatted !== '—' ? formatted : id });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Relations</span>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger render={<Button variant="ghost" size="sm" className="size-6 p-0" />}>
            <Plus className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <Select value={targetType} onValueChange={(v) => v && setTargetType(v)}>
              <SelectTrigger className="mb-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_OBJECT_NAMES.map((name) => (
                  <SelectItem key={name} value={name}>
                    {objectByName.get(name)?.labelSingular ?? name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input autoFocus placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {candidates?.records.map((record) => {
                const label = candidateLabelField ? formatFieldValue(candidateLabelField, record) : String(record.id);
                return (
                  <button
                    key={record.id as string}
                    type="button"
                    className="flex w-full items-center rounded px-1 py-1 text-left text-sm hover:bg-muted"
                    onClick={() => linkMutation.mutate(record.id as string)}
                  >
                    <RecordChip name={label === '—' ? String(record.id) : label} />
                  </button>
                );
              })}
              {candidates?.records.length === 0 && <p className="p-1 text-xs text-muted-foreground">No matches.</p>}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {chips.length === 0 ? (
        <p className="text-xs text-muted-foreground">No relations yet.</p>
      ) : (
        <div className="space-y-1">
          {chips.map((chip) => (
            <div key={chip.junctionRowId} className="group/chip flex items-center gap-1 rounded border px-2 py-1">
              <Link to={`/objects/${chip.namePlural}/${chip.recordId}`} className="min-w-0 flex-1 hover:underline">
                <RecordChip name={chip.label} />
              </Link>
              <button
                type="button"
                aria-label="Unlink"
                onClick={() => unlinkMutation.mutate(chip.junctionRowId)}
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground group-hover/chip:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
