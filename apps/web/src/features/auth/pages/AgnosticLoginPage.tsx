import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router';
import { loginRequestSchema, type LoginRequest } from '@saasly/shared';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authApi, ApiError } from '@/lib/api-client';
import { AuthCard } from '../components/AuthCard';

export function AgnosticLoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginRequest): Promise<void> {
    setError(null);
    try {
      const result = await authApi.loginAgnostic(values.email, values.password);

      if (result.requiresTwoFactor) {
        navigate('/2fa', { state: { challengeToken: result.challengeToken } });
        return;
      }
      if ('redirectUrl' in result) {
        window.location.href = result.redirectUrl;
        return;
      }
      if (result.workspaces.length === 0) {
        navigate('/create-workspace', { state: { token: result.workspaceAgnosticToken } });
        return;
      }
      navigate('/select-workspace', { state: { token: result.workspaceAgnosticToken, workspaces: result.workspaces } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }

  return (
    <AuthCard title="Log in" description="Welcome back to Saasly CRM.">
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
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="current-password" {...field} />
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
            Log in
          </Button>
        </form>
      </Form>
      <div className="mt-4 flex justify-between text-sm text-slate-500">
        <Link to="/reset-password" className="underline">
          Forgot password?
        </Link>
        <Link to="/signup" className="underline">
          Sign up
        </Link>
      </div>
    </AuthCard>
  );
}
