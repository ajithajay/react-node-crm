import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Paperclip, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { filesApi, recordApi, resolveFileUrl } from '@/lib/api-client';

/**
 * Files tab — attachments carry their own MORPH_RELATION target directly (no junction object,
 * unlike Notes/Tasks). Upload goes through the generic `/files/upload` route, then an attachment
 * record is created pointing at the uploaded file's URL. Deleting only removes the attachment
 * record — the underlying stored file isn't cleaned up (no authenticated delete-file route exists
 * yet; see file.service.ts's own `deleteFile`, which is currently only reachable server-side for
 * avatar/logo replacement).
 */
export function RecordAttachmentsWidget({
  sourceObjectNameSingular,
  sourceRecordId,
}: {
  sourceObjectNameSingular: string;
  sourceRecordId: string;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const queryKey = ['record-attachments', sourceRecordId];

  const { data } = useQuery({
    queryKey,
    queryFn: () =>
      recordApi.list('attachments', {
        filter: [
          { field: 'targetType', operand: 'IS', value: sourceObjectNameSingular },
          { field: 'targetId', operand: 'IS', value: sourceRecordId },
        ],
        pageSize: 100,
      }),
  });

  const invalidate = (): void => void queryClient.invalidateQueries({ queryKey });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await filesApi.upload(file);
      await recordApi.create('attachments', {
        name: file.name,
        fullPath: uploaded.url,
        type: file.type || 'application/octet-stream',
        targetType: sourceObjectNameSingular,
        targetId: sourceRecordId,
      });
    },
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => recordApi.remove('attachments', id),
    onSuccess: invalidate,
  });

  const attachments = data?.records ?? [];

  return (
    <div className="space-y-2 py-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Files</span>
        <Button variant="ghost" size="sm" className="size-6 p-0" onClick={() => inputRef.current?.click()}>
          <Paperclip className="size-3.5" />
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
            e.target.value = '';
          }}
        />
      </div>
      <div className="space-y-1.5">
        {attachments.map((a) => (
          <div key={a.id as string} className="flex items-center justify-between rounded border px-2 py-1.5 text-sm">
            <a
              href={resolveFileUrl(a.fullPath as string | null) ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-1.5 truncate hover:underline"
            >
              <Download className="size-3.5 shrink-0" />
              <span className="truncate">{String(a.name ?? 'Untitled')}</span>
            </a>
            <Button
              variant="ghost"
              size="sm"
              className="size-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeMutation.mutate(a.id as string)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        {attachments.length === 0 && <p className="text-xs text-muted-foreground">No files yet.</p>}
      </div>
    </div>
  );
}
