import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { createRoleRequestSchema, type CreateRoleRequest } from '@saasly/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, roleApi } from '@/lib/api-client';
import { getIcon } from '@/lib/icons';

function CreateRoleDialog() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CreateRoleRequest>({
    resolver: zodResolver(createRoleRequestSchema),
    defaultValues: { label: '', description: '' },
  });

  const create = useMutation({
    mutationFn: (values: CreateRoleRequest) => roleApi.create(values),
    onSuccess: (role) => {
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
      setOpen(false);
      form.reset();
      navigate(`/settings/roles/${role.id}`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add role</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a role</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => create.mutate(values))} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Sales Rep" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ''} />
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
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Create role
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function RolesTab() {
  const navigate = useNavigate();
  const { data: roles, isLoading } = useQuery({ queryKey: ['roles'], queryFn: roleApi.list });

  return (
    <div>
      <div className="flex items-center justify-end">
        <CreateRoleDialog />
      </div>

      <div className="mt-4 divide-y rounded-lg border">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {roles?.map((role) => {
          const Icon = getIcon(role.icon);
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => navigate(`/settings/roles/${role.id}`)}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
            >
              <Icon className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{role.label}</p>
              </div>
              {!role.isEditable && <Badge variant="secondary">Built-in</Badge>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
