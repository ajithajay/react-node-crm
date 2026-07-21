import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AUDIT_LOG_ACTIONS,
  EDITABLE_PROFILE_FIELDS,
  type EditableProfileField,
  updateWorkspaceRequestSchema,
  type UpdateWorkspaceRequest,
} from '@saasly/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError, authApi, auditLogApi, memberApi, resolveFileUrl, roleApi, workspaceApi } from '@/lib/api-client';
import { APP_BASE_DOMAIN } from '@/lib/host';
import { useAuthSession } from '@/lib/auth-session';

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
              <div>
                <Label className="text-muted-foreground">Workspace URL</Label>
                <p className="mt-1 text-sm">
                  {form.watch('subdomain') || workspace.subdomain}.{APP_BASE_DOMAIN}
                </p>
              </div>
              <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
                Save
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom domain</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input value={workspace.customDomain ?? ''} disabled placeholder="crm.yourcompany.com" className="max-w-sm" />
          <p className="text-xs text-muted-foreground">
            Custom domains (with DNS verification) are planned for a future release. Your workspace is reachable at{' '}
            <span className="font-medium">
              {workspace.subdomain}.{APP_BASE_DOMAIN}
            </span>{' '}
            today.
          </p>
        </CardContent>
      </Card>

      <DangerZone workspaceName={workspace.name} workspaceSubdomain={workspace.subdomain} />
    </div>
  );
}

function DangerZone({ workspaceName, workspaceSubdomain }: { workspaceName: string; workspaceSubdomain: string }) {
  const { clearSession } = useAuthSession();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: workspaceApi.remove,
    onSuccess: async () => {
      await authApi.logout().catch(() => undefined);
      clearSession();
      // The subdomain no longer resolves — send the user to the app landing host.
      const port = window.location.port ? `:${window.location.port}` : '';
      window.location.href = `${window.location.protocol}//app.${APP_BASE_DOMAIN}${port}/login`;
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Delete failed'),
  });

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Delete this workspace</p>
          <p className="text-xs text-muted-foreground">
            Permanently deletes {workspaceName} and all its data. This cannot be undone.
          </p>
        </div>
        <Button variant="destructive" onClick={() => { setConfirm(''); setError(null); setOpen(true); }}>
          Delete workspace
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workspace</DialogTitle>
            <DialogDescription>
              This permanently deletes the workspace and every record, member, and setting in it. Type{' '}
              <span className="font-medium">{workspaceSubdomain}</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input autoFocus value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={workspaceSubdomain} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirm !== workspaceSubdomain || remove.isPending}
              onClick={() => remove.mutate()}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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

  const setEditableFields = useMutation({
    mutationFn: (fields: EditableProfileField[]) =>
      workspaceApi.update({ name: workspace!.name, subdomain: workspace!.subdomain, editableProfileFields: fields }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['workspace'] }),
  });

  const setSyncInternalEmails = useMutation({
    mutationFn: (syncInternalEmails: boolean) => workspaceApi.updateSecurity({ syncInternalEmails }),
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
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Which fields members are allowed to change on their own profile.
          </p>
          {EDITABLE_PROFILE_FIELDS.map((fieldKey) => {
            const checked = (workspace.editableProfileFields ?? []).includes(fieldKey);
            return (
              <label key={fieldKey} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => {
                    const next = c === true
                      ? [...new Set([...(workspace.editableProfileFields ?? []), fieldKey])]
                      : (workspace.editableProfileFields ?? []).filter((f) => f !== fieldKey);
                    setEditableFields.mutate(next as EditableProfileField[]);
                  }}
                />
                {FIELD_LABELS[fieldKey]}
              </label>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email sync</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={workspace.syncInternalEmails}
              onCheckedChange={(c) => setSyncInternalEmails.mutate(c === true)}
              disabled={setSyncInternalEmails.isPending}
            />
            <span>
              <span className="font-medium">Sync internal emails</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                By default, emails where every participant shares your workspace domain are not synced, to protect
                privacy. Enable this to include internal emails workspace-wide (useful for shared-domain organizations).
              </span>
            </span>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}

const FIELD_LABELS: Record<EditableProfileField, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  profilePicture: 'Profile picture',
};

function LogsTab() {
  const [action, setAction] = useState<string | undefined>(undefined);
  const [actorUserId, setActorUserId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: members } = useQuery({ queryKey: ['members'], queryFn: memberApi.list });

  const { data } = useQuery({
    queryKey: ['audit-logs', action, actorUserId, search, from, to, page],
    queryFn: () =>
      auditLogApi.list({
        action,
        actorUserId,
        search: search || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize,
      }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const resetPage = () => setPage(1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit logs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Action</Label>
            <Select
              value={action ?? 'all'}
              onValueChange={(value) => {
                if (!value) return;
                setAction(value === 'all' ? undefined : value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-56">
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
          </div>
          <div>
            <Label className="text-xs">Actor</Label>
            <Select
              value={actorUserId ?? 'all'}
              onValueChange={(value) => {
                if (!value) return;
                setActorUserId(value === 'all' ? undefined : value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone</SelectItem>
                {members?.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" className="w-40" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" className="w-40" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }} />
          </div>
          <div>
            <Label className="text-xs">Search</Label>
            <Input
              className="w-48"
              placeholder="Filter actions…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            />
          </div>
        </div>

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
