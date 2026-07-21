import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { createImapSmtpAccountRequestSchema, type CreateImapSmtpAccountRequest } from '@saasly/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ApiError, connectedAccountApi } from '@/lib/api-client';

export function NewImapAccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateImapSmtpAccountRequest>({
    // The schema uses zod `.default()`s (input ≠ output), so cast to the output-typed resolver.
    resolver: zodResolver(createImapSmtpAccountRequestSchema) as Resolver<CreateImapSmtpAccountRequest>,
    defaultValues: {
      handle: '',
      imapHost: '',
      imapPort: 993,
      imapSecure: true,
      smtpHost: '',
      smtpPort: 465,
      smtpSecure: true,
      caldavUrl: '',
      username: '',
      password: '',
    },
  });

  async function onSubmit(values: CreateImapSmtpAccountRequest) {
    setError(null);
    setSubmitting(true);
    try {
      await connectedAccountApi.createImapSmtp({ ...values, caldavUrl: values.caldavUrl || undefined });
      await queryClient.invalidateQueries({ queryKey: ['connected-accounts'] });
      navigate('/settings/accounts');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not connect the account');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/settings/accounts/new')} className="mb-2 -ml-2">
          <ChevronLeft className="size-4" /> Back
        </Button>
        <h1 className="text-lg font-medium">Connect IMAP / SMTP</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We verify the connection before saving. CalDAV is optional (for calendar sync). Turn TLS/SSL
          <span className="font-medium"> off</span> if your server uses a plain (unencrypted) port.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="handle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Usually your email address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="App password recommended" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Incoming (IMAP)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <FormField
                  control={form.control}
                  name="imapHost"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Host</FormLabel>
                      <FormControl>
                        <Input placeholder="imap.example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="imapPort"
                  render={({ field }) => (
                    <FormItem className="w-28">
                      <FormLabel>Port</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="imapSecure"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
                      Use TLS/SSL
                    </label>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Outgoing (SMTP)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <FormField
                  control={form.control}
                  name="smtpHost"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Host</FormLabel>
                      <FormControl>
                        <Input placeholder="smtp.example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="smtpPort"
                  render={({ field }) => (
                    <FormItem className="w-28">
                      <FormLabel>Port</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="smtpSecure"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
                      Use TLS/SSL
                    </label>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Calendar (CalDAV, optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="caldavUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CalDAV URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://caldav.example.com/…" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/settings/accounts')}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Connecting…' : 'Test & connect'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
