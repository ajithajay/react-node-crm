import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import type {
  CalendarChannelSummary,
  ContactAutoCreationPolicyValue,
  MessageChannelSummary,
  MessageChannelVisibilityValue,
} from '@saasly/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { connectedAccountApi } from '@/lib/api-client';

const VISIBILITY_LABELS: Record<string, string> = {
  METADATA: 'Metadata only',
  SUBJECT: 'Subject & metadata',
  SHARE_EVERYTHING: 'All email content',
};
const POLICY_LABELS: Record<ContactAutoCreationPolicyValue, string> = {
  NONE: 'Deactivated',
  SENT: 'Sent only',
  SENT_AND_RECEIVED: 'Sent & received',
};

function EmailChannelCard({ channel, accountId }: { channel: MessageChannelSummary; accountId: string }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['connected-account', accountId] });

  const update = useMutation({
    mutationFn: (input: Parameters<typeof connectedAccountApi.updateMessageChannel>[1]) =>
      connectedAccountApi.updateMessageChannel(channel.id, input),
    onSuccess: invalidate,
  });
  const setFolder = useMutation({
    mutationFn: (folder: { id: string; isSynced: boolean }) =>
      connectedAccountApi.updateMessageFolders(channel.id, { folders: [folder] }),
    onSuccess: invalidate,
  });
  const syncNow = useMutation({
    mutationFn: () => connectedAccountApi.syncMessageChannel(channel.id),
    onSuccess: invalidate,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Email</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{channel.syncStatus}</Badge>
          <Button variant="outline" size="sm" onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>
            <RefreshCw className="size-4" /> Sync now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={channel.isSyncEnabled}
            onCheckedChange={(c) => update.mutate({ isSyncEnabled: c === true })}
          />
          Sync enabled
        </label>

        <div className="max-w-xs space-y-2">
          <Label>Message visibility</Label>
          <Select
            value={channel.visibility}
            onValueChange={(v) => update.mutate({ visibility: v as MessageChannelVisibilityValue })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="max-w-xs space-y-2">
          <Label>Contact auto-creation</Label>
          <Select
            value={channel.contactAutoCreationPolicy}
            onValueChange={(v) =>
              update.mutate({
                contactAutoCreationPolicy: v as ContactAutoCreationPolicyValue,
                isContactAutoCreationEnabled: v !== 'NONE',
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(POLICY_LABELS) as ContactAutoCreationPolicyValue[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {POLICY_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={channel.excludeGroupEmails}
            onCheckedChange={(c) => update.mutate({ excludeGroupEmails: c === true })}
          />
          Exclude group / distribution-list emails
        </label>

        <div className="space-y-2">
          <Label>Folders to sync</Label>
          <div className="divide-y rounded-lg border">
            {channel.folders.length === 0 && (
              <p className="p-3 text-xs text-muted-foreground">Folders appear after the first sync.</p>
            )}
            {channel.folders.map((folder) => (
              <label key={folder.id} className="flex items-center gap-2 p-2 text-sm">
                <Checkbox
                  checked={folder.isSynced}
                  onCheckedChange={(c) => setFolder.mutate({ id: folder.id, isSynced: c === true })}
                />
                {folder.name}
                {folder.isSentFolder && <Badge variant="secondary">Sent</Badge>}
              </label>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarChannelCard({ channel, accountId }: { channel: CalendarChannelSummary; accountId: string }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['connected-account', accountId] });

  const update = useMutation({
    mutationFn: (input: Parameters<typeof connectedAccountApi.updateCalendarChannel>[1]) =>
      connectedAccountApi.updateCalendarChannel(channel.id, input),
    onSuccess: invalidate,
  });
  const syncNow = useMutation({
    mutationFn: () => connectedAccountApi.syncCalendarChannel(channel.id),
    onSuccess: invalidate,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Calendar</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{channel.syncStatus}</Badge>
          <Button variant="outline" size="sm" onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>
            <RefreshCw className="size-4" /> Sync now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={channel.isSyncEnabled}
            onCheckedChange={(c) => update.mutate({ isSyncEnabled: c === true })}
          />
          Sync enabled
        </label>
        <div className="max-w-xs space-y-2">
          <Label>Event visibility</Label>
          <Select value={channel.visibility} onValueChange={(v) => update.mutate({ visibility: v as 'METADATA' | 'SHARE_EVERYTHING' })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SHARE_EVERYTHING">Everything</SelectItem>
              <SelectItem value="METADATA">Metadata only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={channel.isContactAutoCreationEnabled}
            onCheckedChange={(c) => update.mutate({ isContactAutoCreationEnabled: c === true })}
          />
          Create contacts from meeting participants
        </label>
      </CardContent>
    </Card>
  );
}

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: account, isLoading } = useQuery({
    queryKey: ['connected-account', id],
    queryFn: () => connectedAccountApi.get(id!),
    enabled: !!id,
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/settings/accounts')} className="mb-2 -ml-2">
          <ChevronLeft className="size-4" /> Accounts
        </Button>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {account && (
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-medium">{account.handle}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{account.provider}</p>
            </div>
            {account.provider === 'IMAP_SMTP_CALDAV' && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/settings/accounts/${account.id}/edit`)}>
                Edit connection
              </Button>
            )}
          </div>
        )}
      </div>

      {account?.messageChannel && <EmailChannelCard channel={account.messageChannel} accountId={account.id} />}
      {account?.calendarChannel && <CalendarChannelCard channel={account.calendarChannel} accountId={account.id} />}
    </div>
  );
}
