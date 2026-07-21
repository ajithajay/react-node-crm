import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { type ConnectedAccount, connectedAccountApi } from '@/lib/api-client';

const PROVIDER_LABELS: Record<ConnectedAccount['provider'], string> = {
  GOOGLE: 'Google',
  MICROSOFT: 'Microsoft',
  IMAP_SMTP_CALDAV: 'IMAP / SMTP',
};

function AuthStatusBadge({ status }: { status: ConnectedAccount['authStatus'] }) {
  if (status === 'CONNECTED') return <Badge variant="secondary">Connected</Badge>;
  if (status === 'FAILED') return <Badge variant="destructive">Auth failed</Badge>;
  return <Badge>Pending</Badge>;
}

export function AccountsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['connected-accounts'],
    queryFn: connectedAccountApi.list,
  });
  const [toDelete, setToDelete] = useState<ConnectedAccount | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => connectedAccountApi.remove(id),
    onSuccess: () => {
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['connected-accounts'] });
    },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-medium">Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your email and calendar accounts to sync messages and events onto your records.
          </p>
        </div>
        <Button onClick={() => navigate('/settings/accounts/new')}>
          <Plus className="size-4" /> Add account
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && accounts?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <Mail className="size-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">No accounts connected</p>
            <p className="text-xs text-muted-foreground">Connect a Google or IMAP/SMTP account to get started.</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/settings/accounts/new')}>
            <Plus className="size-4" /> Add account
          </Button>
        </div>
      )}

      {!!accounts?.length && (
        <div className="divide-y rounded-lg border">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center gap-3 p-3">
              <Mail className="size-5 text-muted-foreground" />
              <Link to={`/settings/accounts/${account.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{account.handle}</p>
                <p className="truncate text-xs text-muted-foreground">{PROVIDER_LABELS[account.provider]}</p>
              </Link>
              <AuthStatusBadge status={account.authStatus} />
              <Button variant="ghost" size="icon" onClick={() => setToDelete(account)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove account</DialogTitle>
            <DialogDescription>
              Disconnect {toDelete?.handle}? Synced messages and events already on your records are kept, but no new
              data will sync.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => toDelete && remove.mutate(toDelete.id)}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
