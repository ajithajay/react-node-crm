import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createApiKeyRequestSchema,
  createWebhookRequestSchema,
  WEBHOOK_EVENTS,
  type CreateApiKeyRequest,
  type CreateWebhookRequest,
} from '@saasly/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  ApiError,
  type ApiKey,
  type DataModelObject,
  type Webhook,
  apiKeyApi,
  dataModelApi,
  roleApi,
  webhookApi,
} from '@/lib/api-client';
import { ApiPlaygroundTab } from './ApiPlaygroundTab';

function roleLabel(roles: { id: string; label: string }[] | undefined, roleId: string | null): string {
  return roles?.find((r) => r.id === roleId)?.label ?? 'No role';
}

const NO_ROLE_SELECTED = 'none';
const ALL_OPERATIONS = ['*.*'];

function CreateApiKeyDialog({ onCreated }: { onCreated: (token: string) => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: roleApi.list });

  const form = useForm<CreateApiKeyRequest>({
    resolver: zodResolver(createApiKeyRequestSchema),
    defaultValues: { name: '', roleId: undefined, expiresAt: undefined },
  });

  const create = useMutation({
    mutationFn: (values: CreateApiKeyRequest) => apiKeyApi.create(values),
    onSuccess: ({ token }) => {
      setError(null);
      setOpen(false);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      onCreated(token);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create API key</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create an API key</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => create.mutate(values))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="CI integration" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    value={field.value ?? NO_ROLE_SELECTED}
                    onValueChange={(value) => field.onChange(value === NO_ROLE_SELECTED ? undefined : value)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_ROLE_SELECTED}>No role</SelectItem>
                      {roles?.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="expiresAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expires (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || undefined)}
                    />
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
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function NewApiKeyTokenDialog({ token, onClose }: { token: string | null; onClose: () => void }) {
  return (
    <Dialog open={token !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API key created</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Copy this key now — it won&apos;t be shown again.
        </p>
        <Textarea readOnly value={token ?? ''} className="font-mono text-xs" rows={3} />
        <DialogFooter>
          <Button onClick={() => token && void navigator.clipboard.writeText(token)}>Copy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function apiKeyStatus(apiKey: ApiKey): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (apiKey.isRevoked) return { label: 'Revoked', variant: 'secondary' };
  if (apiKey.isExpired) return { label: 'Expired', variant: 'destructive' };
  return { label: 'Active', variant: 'default' };
}

function ApiKeysTab() {
  const queryClient = useQueryClient();
  const [newToken, setNewToken] = useState<string | null>(null);
  const { data: apiKeys, isLoading } = useQuery({ queryKey: ['api-keys'], queryFn: apiKeyApi.list });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: roleApi.list });

  const revoke = useMutation({
    mutationFn: (id: string) => apiKeyApi.revoke(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  return (
    <div>
      <div className="flex items-center justify-end">
        <CreateApiKeyDialog onCreated={setNewToken} />
      </div>

      <div className="mt-4 divide-y rounded-lg border">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {apiKeys?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No API keys yet.</p>}
        {apiKeys?.map((apiKey: ApiKey) => {
          const status = apiKeyStatus(apiKey);
          return (
            <div key={apiKey.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{apiKey.name}</p>
                <p className="text-xs text-muted-foreground">
                  {roleLabel(roles, apiKey.roleId)} · Created {new Date(apiKey.createdAt).toLocaleDateString()}
                  {apiKey.expiresAt && ` · Expires ${new Date(apiKey.expiresAt).toLocaleDateString()}`}
                </p>
              </div>
              <Badge variant={status.variant}>{status.label}</Badge>
              {!apiKey.isRevoked && (
                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(apiKey.id)}>
                  Revoke
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <NewApiKeyTokenDialog token={newToken} onClose={() => setNewToken(null)} />
    </div>
  );
}

/** Checkbox grid of `object.event` combinations, backed by the real object list (Phase 5h metadata). */
function WebhookEventPicker({ value, onChange }: { value: string[]; onChange: (operations: string[]) => void }) {
  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const isAllSelected = value.length === 1 && value[0] === '*.*';
  const activeObjects = (objects ?? []).filter((o: DataModelObject) => o.isActive);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox
          checked={isAllSelected}
          onCheckedChange={(checked) => onChange(checked === true ? ALL_OPERATIONS : [])}
        />
        All objects · all events (<code>*.*</code>)
      </label>
      <div className="max-h-64 space-y-2 overflow-y-auto border-t pt-2">
        {activeObjects.length === 0 && <p className="text-xs text-muted-foreground">No objects yet.</p>}
        {activeObjects.map((object: DataModelObject) => (
          <div key={object.id} className="flex items-center gap-4">
            <span className="w-32 shrink-0 truncate text-sm">{object.labelSingular}</span>
            {WEBHOOK_EVENTS.map((event) => {
              const operation = `${object.nameSingular}.${event}`;
              const checked = isAllSelected || value.includes(operation);
              return (
                <label key={event} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    checked={checked}
                    disabled={isAllSelected}
                    onCheckedChange={(next) =>
                      onChange(next === true ? [...value, operation] : value.filter((v) => v !== operation))
                    }
                  />
                  {event}
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateWebhookDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateWebhookRequest>({
    resolver: zodResolver(createWebhookRequestSchema),
    defaultValues: { targetUrl: '', operations: ALL_OPERATIONS, description: '' },
  });

  const create = useMutation({
    mutationFn: (values: CreateWebhookRequest) => webhookApi.create(values),
    onSuccess: () => {
      setError(null);
      setOpen(false);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create webhook</Button>} />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a webhook</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => create.mutate(values))} className="space-y-4">
            <FormField
              control={form.control}
              name="targetUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/hooks/crm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="operations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Events</FormLabel>
                  <FormControl>
                    <WebhookEventPicker value={field.value} onChange={field.onChange} />
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
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function WebhookSecretCell({ webhook }: { webhook: Webhook }) {
  const queryClient = useQueryClient();
  const [revealed, setRevealed] = useState(false);

  const regenerate = useMutation({
    mutationFn: () => webhookApi.regenerateSecret(webhook.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const displayValue = webhook.secret ?? '';
  return (
    <div className="flex items-center gap-1.5">
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
        {revealed ? displayValue : '•'.repeat(12)}
      </code>
      <Button variant="ghost" size="sm" onClick={() => setRevealed((r) => !r)}>
        {revealed ? 'Hide' : 'Reveal'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => void navigator.clipboard.writeText(displayValue)}>
        Copy
      </Button>
      <Button variant="ghost" size="sm" disabled={regenerate.isPending} onClick={() => regenerate.mutate()}>
        Regenerate
      </Button>
    </div>
  );
}

function WebhooksTab() {
  const queryClient = useQueryClient();
  const { data: webhooks, isLoading } = useQuery({ queryKey: ['webhooks'], queryFn: webhookApi.list });

  const remove = useMutation({
    mutationFn: (id: string) => webhookApi.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  return (
    <div>
      <div className="flex items-center justify-end">
        <CreateWebhookDialog />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        The signing secret will be used to HMAC-SHA256-sign delivered payloads once webhook delivery ships
        (Phase 6) — copy it into your receiver now so it&apos;s ready.
      </p>

      <div className="mt-4 divide-y rounded-lg border">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {webhooks?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No webhooks yet.</p>}
        {webhooks?.map((webhook: Webhook) => (
          <div key={webhook.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{webhook.targetUrl}</p>
              <p className="truncate text-xs text-muted-foreground">
                {webhook.operations.join(', ')}
                {webhook.description && ` · ${webhook.description}`}
              </p>
              <div className="mt-1">
                <WebhookSecretCell webhook={webhook} />
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => remove.mutate(webhook.id)}>
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApiSettingsPage() {
  return (
    <div>
      <h1 className="text-lg font-medium">API &amp; Webhooks</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage API keys and outbound webhooks.</p>

      <Tabs defaultValue="api-keys" className="mt-4">
        <TabsList>
          <TabsTrigger value="api-keys">API keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="docs">Docs &amp; Playground</TabsTrigger>
        </TabsList>
        <TabsContent value="api-keys">
          <ApiKeysTab />
        </TabsContent>
        <TabsContent value="webhooks">
          <WebhooksTab />
        </TabsContent>
        <TabsContent value="docs">
          <ApiPlaygroundTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
