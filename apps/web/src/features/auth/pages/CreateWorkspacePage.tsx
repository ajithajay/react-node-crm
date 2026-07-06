import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation } from 'react-router';
import { createWorkspaceRequestSchema, type CreateWorkspaceRequest } from '@saasly/shared';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authApi, ApiError } from '@/lib/api-client';
import { AuthCard } from '../components/AuthCard';

export function CreateWorkspacePage() {
  const location = useLocation();
  const token = (location.state as { token?: string } | null)?.token;
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const form = useForm<CreateWorkspaceRequest>({
    resolver: zodResolver(createWorkspaceRequestSchema),
    defaultValues: { name: '', subdomain: '' },
  });

  async function onSubmit(values: CreateWorkspaceRequest): Promise<void> {
    if (!token) return;
    setError(null);
    setSuggestions([]);
    try {
      const result = await authApi.createWorkspace(token, values.name, values.subdomain);
      window.location.href = result.redirectUrl;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        const availability = await authApi.subdomainAvailability(values.subdomain).catch(() => null);
        if (availability?.suggestions) setSuggestions(availability.suggestions);
      } else {
        setError('Something went wrong');
      }
    }
  }

  if (!token) {
    return (
      <AuthCard title="Session expired" description="Please verify your email or log in again to continue.">
        <Link to="/login" className="text-sm underline">
          Back to login
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your workspace" description="This will be your team's home in Saasly CRM.">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Workspace name</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Inc" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="subdomain"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subdomain</FormLabel>
                <FormControl>
                  <Input placeholder="acme" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {suggestions.length > 0 && (
            <p className="text-sm text-slate-500">Try: {suggestions.join(', ')}</p>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            Create workspace
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
