import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router';
import {
  passwordResetRequestSchema,
  passwordSchema,
  type PasswordResetRequest,
} from '@saasly/shared';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authApi, ApiError } from '@/lib/api-client';
import { AuthCard } from '../components/AuthCard';

const newPasswordSchema = z.object({ password: passwordSchema });
type NewPasswordForm = z.infer<typeof newPasswordSchema>;

function RequestResetForm() {
  const [submitted, setSubmitted] = useState(false);
  const form = useForm<PasswordResetRequest>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: PasswordResetRequest): Promise<void> {
    await authApi.requestPasswordReset(values.email);
    setSubmitted(true);
  }

  if (submitted) {
    return <p className="text-sm text-slate-600">If that email is registered, a reset link is on its way.</p>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          Send reset link
        </Button>
      </form>
    </Form>
  );
}

function ConfirmResetForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<NewPasswordForm>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '' },
  });

  async function onSubmit(values: NewPasswordForm): Promise<void> {
    setError(null);
    try {
      await authApi.confirmPasswordReset(token, values.password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Your password was changed. You can now log in.</p>
        <Link to="/login" className="text-sm underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
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
          Set new password
        </Button>
      </form>
    </Form>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');

  return (
    <AuthCard
      title={token ? 'Set a new password' : 'Reset your password'}
      description={token ? undefined : "We'll email you a link to reset it."}
    >
      {token ? <ConfirmResetForm token={token} /> : <RequestResetForm />}
    </AuthCard>
  );
}
