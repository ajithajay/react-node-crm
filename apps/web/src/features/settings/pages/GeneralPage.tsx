import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AUDIT_LOG_ACTIONS, updateWorkspaceRequestSchema, type UpdateWorkspaceRequest } from '@saasly/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError, authApi, auditLogApi, resolveFileUrl, roleApi, workspaceApi } from '@/lib/api-client';

function LogoSection({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => workspaceApi.uploadLogo(file),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['workspace'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Upload failed'),
  });
  const remove = useMutation({
    mutationFn: workspaceApi.removeLogo,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['workspace'] }),
  });

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16 rounded-lg">
        {logoUrl && <AvatarImage src={resolveFileUrl(logoUrl) ?? undefined} alt={name} />}
        <AvatarFallback className="rounded-lg text-lg">{name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
              event.target.value = '';
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            Upload
          </Button>
          {logoUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={() => remove.mutate()}>
              Remove
            </Button>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function GeneralTab() {
  const queryClient = useQueryClient();
  const { data: workspace } = useQuery({ queryKey: ['workspace'], queryFn: workspaceApi.getCurrent });
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const form = useForm<UpdateWorkspaceRequest>({
    resolver: zodResolver(updateWorkspaceRequestSchema),
    values: workspace ? { name: workspace.name, subdomain: workspace.subdomain } : undefined,
  });

  const update = useMutation({
    mutationFn: (values: UpdateWorkspaceRequest) => workspaceApi.update(values),
    onSuccess: () => {
      setError(null);
      setSuggestions([]);
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: async (err, values) => {
      if (!(err instanceof ApiError)) {
        setError('Something went wrong');
        return;
      }
      setError(err.message);
      const availability = await authApi.subdomainAvailability(values.subdomain).catch(() => null);
      setSuggestions(availability?.suggestions ?? []);
    },
  });

  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <LogoSection name={workspace.name} logoUrl={workspace.logoUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => update.mutate(values))} className="max-w-sm space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workspace name</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {suggestions.length > 0 && <p className="text-sm text-muted-foreground">Try: {suggestions.join(', ')}</p>}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
                Save
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function SecurityTab() {
  const queryClient = useQueryClient();
  const { data: workspace } = useQuery({ queryKey: ['workspace'], queryFn: workspaceApi.getCurrent });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: roleApi.list });

  const setDefaultRole = useMutation({
    mutationFn: (roleId: string) => workspaceApi.setDefaultRole(roleId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['workspace'] }),
  });

  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Default role</CardTitle>
        </CardHeader>
        <CardContent className="max-w-xs space-y-2">
          <Label>Assigned to new members</Label>
          <Select
            value={workspace.defaultRoleId ?? undefined}
            onValueChange={(value) => value && setDefaultRole.mutate(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles?.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Editable profile fields</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Coming in Phase 5e, alongside role-based field-level permissions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function LogsTab() {
  const [action, setAction] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data } = useQuery({
    queryKey: ['audit-logs', action, page],
    queryFn: () => auditLogApi.list({ action, page, pageSize }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit logs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select
          value={action ?? 'all'}
          onValueChange={(value) => {
            if (!value) return;
            setAction(value === 'all' ? undefined : value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {AUDIT_LOG_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-mono text-xs">{entry.action}</TableCell>
                <TableCell>{entry.actorEmail ?? '—'}</TableCell>
                <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {data?.entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  No events yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function GeneralPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-medium">General</h1>
        <p className="mt-1 text-sm text-muted-foreground">Workspace identity, security, and audit logs.</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <GeneralTab />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
        <TabsContent value="logs">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
