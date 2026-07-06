import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation } from 'react-router';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authApi, ApiError } from '@/lib/api-client';
import { AuthCard } from '../components/AuthCard';

const codeSchema = z.object({ code: z.string().length(6, 'Enter the 6-digit code') });
type CodeForm = z.infer<typeof codeSchema>;

export function TwoFactorChallengePage() {
  const location = useLocation();
  const challengeToken = (location.state as { challengeToken?: string } | null)?.challengeToken;
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CodeForm>({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } });

  async function onSubmit(values: CodeForm): Promise<void> {
    if (!challengeToken) return;
    setError(null);
    try {
      const result = await authApi.verifyLoginTwoFactor(challengeToken, values.code);
      window.location.href = result.redirectUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }

  if (!challengeToken) {
    return (
      <AuthCard title="Session expired" description="Please log in again.">
        <Link to="/login" className="text-sm underline">
          Back to login
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Two-factor authentication" description="Enter the 6-digit code from your authenticator app.">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" maxLength={6} autoComplete="one-time-code" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            Verify
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
