import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, MoreHorizontal, Paperclip, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { fileIdFromUrl, filesApi, recordApi, resolveFileUrl } from '@/lib/api-client';

/**
 * Files tab — attachments carry their own MORPH_RELATION target directly (no junction object, unlike
 * Notes/Tasks). Upload → `/files/upload` → an attachment record pointing at the file URL. Matching
 * Twenty's AttachmentRow: inline image preview, rename, download, and a per-file actions menu; delete
 * now removes BOTH the attachment record and the underlying stored file (via `DELETE /files/:id`).
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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
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

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => recordApi.update('attachments', id, { name }),
    onSuccess: () => {
      setRenamingId(null);
      invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (attachment: Record<string, unknown>) => {
      await recordApi.remove('attachments', attachment.id as string);
      const fileId = fileIdFromUrl(attachment.fullPath as string | null);
      if (fileId) await filesApi.remove(fileId).catch(() => undefined); // best-effort blob cleanup
    },
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
        {attachments.map((a) => {
          const url = resolveFileUrl(a.fullPath as string | null) ?? undefined;
          const isImage = String(a.type ?? '').startsWith('image/');
          const isRenaming = renamingId === a.id;
          return (
            <div key={a.id as string} className="flex items-center gap-2 rounded border px-2 py-1.5 text-sm">
              {isImage && url ? (
                <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
                  <img src={url} alt={String(a.name ?? '')} className="size-8 rounded object-cover" />
                </a>
              ) : (
                <FileText className="size-4 shrink-0 text-muted-foreground" />
              )}
              {isRenaming ? (
                <form
                  className="flex min-w-0 flex-1 gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (renameValue.trim()) renameMutation.mutate({ id: a.id as string, name: renameValue.trim() });
                  }}
                >
                  <Input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="h-7" />
                  <Button type="submit" size="sm" className="h-7">
                    Save
                  </Button>
                </form>
              ) : (
                <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                  {String(a.name ?? 'Untitled')}
                </a>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="size-6 shrink-0 p-0" />}>
                  <MoreHorizontal className="size-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => window.open(url, '_blank')}>
                    <Download className="size-3.5" /> Download
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setRenamingId(a.id as string);
                      setRenameValue(String(a.name ?? ''));
                    }}
                  >
                    <Pencil className="size-3.5" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => removeMutation.mutate(a)}>
                    <Trash2 className="size-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
        {attachments.length === 0 && <p className="text-xs text-muted-foreground">No files yet.</p>}
      </div>
    </div>
  );
}
