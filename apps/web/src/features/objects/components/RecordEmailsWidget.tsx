import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Send } from 'lucide-react';
import type { TimelineObjectSingular } from '@saasly/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { connectedAccountApi, messagingApi } from '@/lib/api-client';

const TIMELINE_SINGULARS = new Set(['person', 'company', 'opportunity']);

function participantsLabel(participants: { handle: string; displayName: string | null }[]): string {
  return participants.map((p) => p.displayName || p.handle).join(', ');
}

/** The member's message channels (mailbox options to send from). */
function useChannels() {
  const { data } = useQuery({ queryKey: ['connected-accounts'], queryFn: connectedAccountApi.list });
  return useMemo(
    () =>
      (data ?? [])
        .filter((a) => a.messageChannel)
        .map((a) => ({ id: a.messageChannel!.id, handle: a.handle })),
    [data],
  );
}

function ComposeForm({
  channels,
  initial,
  onSent,
}: {
  channels: { id: string; handle: string }[];
  initial: { to: string; subject: string; messageThreadId?: string };
  onSent: () => void;
}) {
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '');
  const [to, setTo] = useState(initial.to);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState('');

  const send = useMutation({
    mutationFn: () =>
      messagingApi.send({
        messageChannelId: channelId,
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        cc: [],
        bcc: [],
        subject,
        body,
        messageThreadId: initial.messageThreadId ?? null,
      }),
    onSuccess: onSent,
  });

  if (channels.length === 0) {
    return <p className="text-sm text-muted-foreground">Connect a mailbox in Settings → Accounts to send email.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Select value={channelId} onValueChange={(v) => v && setChannelId(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {channels.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.handle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To (comma-separated)</Label>
        <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="someone@example.com" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Subject</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" />
      <div className="flex justify-end">
        <Button onClick={() => send.mutate()} disabled={send.isPending || !channelId || !to.trim()}>
          <Send className="size-4" /> {send.isPending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </div>
  );
}

function ThreadDialog({
  threadId,
  channels,
  onClose,
  onSent,
}: {
  threadId: string | null;
  channels: { id: string; handle: string }[];
  onClose: () => void;
  onSent: () => void;
}) {
  const { data: thread, isLoading } = useQuery({
    queryKey: ['email-thread', threadId],
    queryFn: () => messagingApi.getThread(threadId!),
    enabled: !!threadId,
  });

  const channelHandles = new Set(channels.map((c) => c.handle.toLowerCase()));
  const replyTo = thread
    ? [...new Set(thread.messages.flatMap((m) => m.participants.map((p) => p.handle)))]
        .filter((h) => !channelHandles.has(h.toLowerCase()))
        .join(', ')
    : '';

  return (
    <Dialog open={threadId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{thread?.subject || 'Email thread'}</DialogTitle>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        <div className="max-h-[45vh] space-y-4 overflow-y-auto">
          {thread?.messages.map((message) => (
            <div key={message.id} className="rounded-lg border p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-medium">{participantsLabel(message.participants)}</p>
                <div className="flex items-center gap-2">
                  <Badge variant={message.direction === 'OUTGOING' ? 'default' : 'secondary'}>
                    {message.direction === 'OUTGOING' ? 'Sent' : 'Received'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {message.receivedAt ? new Date(message.receivedAt).toLocaleString() : ''}
                  </span>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{message.text || '(no content)'}</p>
            </div>
          ))}
        </div>
        {thread && (
          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">Reply</p>
            <ComposeForm
              channels={channels}
              initial={{ to: replyTo, subject: `Re: ${thread.subject}`, messageThreadId: thread.id }}
              onSent={onSent}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RecordEmailsWidget({
  objectNameSingular,
  recordId,
}: {
  objectNameSingular: string;
  recordId: string;
}) {
  const queryClient = useQueryClient();
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const channels = useChannels();
  const isSupported = TIMELINE_SINGULARS.has(objectNameSingular);

  const { data, isLoading } = useQuery({
    queryKey: ['email-threads', objectNameSingular, recordId],
    queryFn: () => messagingApi.listThreads(objectNameSingular as TimelineObjectSingular, recordId),
    enabled: isSupported,
  });

  // Send is processed async by the worker; refresh shortly after so the outgoing message shows up.
  function afterSent() {
    setComposing(false);
    setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ['email-threads', objectNameSingular, recordId] });
      if (openThread) void queryClient.invalidateQueries({ queryKey: ['email-thread', openThread] });
    }, 1500);
  }

  if (!isSupported) {
    return <p className="text-sm text-muted-foreground">Emails are available on People, Companies, and Opportunities.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setComposing(true)}>
          <Mail className="size-4" /> Compose
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && (!data || data.threads.length === 0) && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
          <Mail className="size-7 text-muted-foreground" />
          <p className="text-sm font-medium">No emails yet</p>
          <p className="text-xs text-muted-foreground">
            Connect a mailbox in Settings → Accounts. Synced emails with this contact will appear here.
          </p>
        </div>
      )}

      {!!data?.threads.length && (
        <div className="divide-y rounded-lg border">
          {data.threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => setOpenThread(thread.id)}
              className="flex w-full flex-col gap-1 p-3 text-left hover:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{thread.subject || '(no subject)'}</p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleDateString() : ''}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{participantsLabel(thread.participants)}</p>
              {thread.snippet && <p className="truncate text-xs text-muted-foreground">{thread.snippet}</p>}
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {thread.messageCount} message{thread.messageCount === 1 ? '' : 's'}
                </Badge>
                {thread.sourceHandle && <span className="text-[11px] text-muted-foreground">via {thread.sourceHandle}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      <ThreadDialog
        threadId={openThread}
        channels={channels}
        onClose={() => setOpenThread(null)}
        onSent={afterSent}
      />

      <Dialog open={composing} onOpenChange={(open) => !open && setComposing(false)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New email</DialogTitle>
          </DialogHeader>
          <ComposeForm channels={channels} initial={{ to: '', subject: '' }} onSent={afterSent} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
