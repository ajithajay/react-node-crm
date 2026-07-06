import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ApiError, twoFactorApi } from '@/lib/api-client';

const codeSchema = z.object({ code: z.string().length(6, 'Enter the 6-digit code') });
type CodeForm = z.infer<typeof codeSchema>;

export function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const [enrollment, setEnrollment] = useState<{ otpauthUrl: string; secret: string; qrCodeDataUrl: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CodeForm>({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } });

  const startEnroll = useMutation({
    mutationFn: twoFactorApi.enroll,
    onSuccess: (data) => {
      setError(null);
      setEnrollment(data);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const verifyEnroll = useMutation({
    mutationFn: (code: string) => twoFactorApi.verifyEnroll(code),
    onSuccess: () => {
      setEnrollment(null);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Invalid code'),
  });

  const deactivate = useMutation({
    mutationFn: twoFactorApi.deactivate,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['me'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Two-Factor Authentication
          <Badge variant={enabled ? 'default' : 'secondary'}>{enabled ? 'Active' : 'Deactivated'}</Badge>
        </CardTitle>
        <CardDescription>Require a code from an authenticator app when logging in.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {enabled && (
          <Button variant="destructive" onClick={() => deactivate.mutate()} disabled={deactivate.isPending}>
            Deactivate
          </Button>
        )}

        {!enabled && !enrollment && (
          <Button onClick={() => startEnroll.mutate()} disabled={startEnroll.isPending}>
            Enable 2FA
          </Button>
        )}

        {!enabled && enrollment && (
          <div className="space-y-4">
            <img src={enrollment.qrCodeDataUrl} alt="2FA QR code" className="size-40 rounded-md border" />
            <p className="text-xs text-muted-foreground">
              Can't scan? Enter this code manually: <code className="font-mono">{enrollment.secret}</code>
            </p>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => verifyEnroll.mutate(values.code))}
                className="flex items-end gap-2"
              >
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input inputMode="numeric" maxLength={6} autoComplete="one-time-code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={verifyEnroll.isPending}>
                  Save
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEnrollment(null)}>
                  Cancel
                </Button>
              </form>
            </Form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
