import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { passwordSchema } from '@saasly/shared';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiError, publicInvitationApi } from '@/lib/api-client';
import { AuthCard } from '../components/AuthCard';

const passwordFormSchema = z.object({ password: passwordSchema });
type PasswordForm = z.infer<typeof passwordFormSchema>;

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [error, setError] = useState<string | null>(null);
  const form = useForm<PasswordForm>({ resolver: zodResolver(passwordFormSchema), defaultValues: { password: '' } });

  const { data: preview, isLoading, isError } = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => publicInvitationApi.preview(token!),
    enabled: !!token,
    retry: false,
  });

  async function onSubmit(values: PasswordForm): Promise<void> {
    if (!token) return;
    setError(null);
    try {
      const result = await publicInvitationApi.accept(token, values.password);
      window.location.href = result.redirectUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }

  if (!token || isError) {
    return (
      <AuthCard title="Invitation not found" description="This invite link is invalid or has expired.">
        <Link to="/login" className="text-sm underline">
          Back to login
        </Link>
      </AuthCard>
    );
  }

  if (isLoading || !preview) {
    return <AuthCard title="Loading invitation">Please wait…</AuthCard>;
  }

  return (
    <AuthCard
      title={`Join ${preview.workspaceName}`}
      description={
        preview.hasAccount
          ? `Enter the password for ${preview.email} to accept this invite.`
          : `Set a password for ${preview.email} to create your account and join.`
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete={preview.hasAccount ? 'current-password' : 'new-password'} {...field} />
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
            {preview.hasAccount ? 'Accept invite' : 'Create account & join'}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
