import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import type { UpdateImapSmtpAccountRequest } from '@saasly/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, connectedAccountApi } from '@/lib/api-client';

type FormState = UpdateImapSmtpAccountRequest;

export function EditImapAccountPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: account } = useQuery({
    queryKey: ['connected-account', id],
    queryFn: () => connectedAccountApi.get(id!),
    enabled: !!id,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (account?.imapSmtp && !form) {
      setForm({ ...account.imapSmtp, password: '' });
    }
  }, [account, form]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function onSubmit() {
    if (!form || !id) return;
    setError(null);
    setSubmitting(true);
    try {
      await connectedAccountApi.updateImapSmtp(id, { ...form, password: form.password || undefined });
      await queryClient.invalidateQueries({ queryKey: ['connected-account', id] });
      navigate(`/settings/accounts/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the account');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/settings/accounts/${id}`)} className="mb-2 -ml-2">
          <ChevronLeft className="size-4" /> Back
        </Button>
        <h1 className="text-lg font-medium">Edit connection</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {account?.handle}. Leave the password blank to keep the current one. Turn TLS/SSL off for plain ports.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {form && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Username</Label>
                <Input value={form.username} onChange={(e) => set('username', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={form.password ?? ''}
                  placeholder="Unchanged"
                  onChange={(e) => set('password', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Incoming (IMAP)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <Label>Host</Label>
                  <Input value={form.imapHost} onChange={(e) => set('imapHost', e.target.value)} />
                </div>
                <div className="w-28 space-y-1">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={form.imapPort}
                    onChange={(e) => set('imapPort', Number(e.target.value))}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.imapSecure} onCheckedChange={(c) => set('imapSecure', c === true)} />
                Use TLS/SSL
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Outgoing (SMTP)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <Label>Host</Label>
                  <Input value={form.smtpHost} onChange={(e) => set('smtpHost', e.target.value)} />
                </div>
                <div className="w-28 space-y-1">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={form.smtpPort}
                    onChange={(e) => set('smtpPort', Number(e.target.value))}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.smtpSecure} onCheckedChange={(c) => set('smtpSecure', c === true)} />
                Use TLS/SSL
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Calendar (CalDAV, optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={form.caldavUrl ?? ''}
                placeholder="https://caldav.example.com/…"
                onChange={(e) => set('caldavUrl', e.target.value)}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate(`/settings/accounts/${id}`)}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={submitting}>
              {submitting ? 'Verifying…' : 'Test & save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
