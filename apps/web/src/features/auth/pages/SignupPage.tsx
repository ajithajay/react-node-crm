import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { signupRequestSchema, type SignupRequest } from '@saasly/shared';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authApi, ApiError } from '@/lib/api-client';
import { AuthCard } from '../components/AuthCard';

export function SignupPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SignupRequest>({
    resolver: zodResolver(signupRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: SignupRequest): Promise<void> {
    setError(null);
    try {
      await authApi.signup(values.email, values.password);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }

  if (submitted) {
    return (
      <AuthCard title="Check your email" description="We've sent a verification link to your email address.">
        <Link to="/login" className="text-sm underline">
          Back to login
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" description="Start your Saasly CRM workspace.">
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
            Sign up
          </Button>
        </form>
      </Form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
