import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import {
  Database,
  Download,
  Eye,
  Flame,
  KeyRound,
  Lock,
  Pencil,
  Plug,
  Plus,
  Search,
  Settings as SettingsIcon,
  Table2,
  Trash,
  Upload,
  Users,
  Workflow,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  PermissionFlagType,
  updateRoleRequestSchema,
  type UpdateRoleRequest,
} from '@saasly/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { IconPicker } from '@/components/IconPicker';
import {
  ApiError,
  type Member,
  type RoleDetail,
  meApi,
  memberApi,
  roleApi,
} from '@/lib/api-client';
import { ROLE_ICON_OPTIONS, getIcon } from '@/lib/icons';

function roleToUpdateInput(role: RoleDetail): UpdateRoleRequest {
  return {
    label: role.label,
    description: role.description,
    icon: role.icon,
    canUpdateAllSettings: role.canUpdateAllSettings,
    canReadAllObjectRecords: role.canReadAllObjectRecords,
    canUpdateAllObjectRecords: role.canUpdateAllObjectRecords,
    canSoftDeleteAllObjectRecords: role.canSoftDeleteAllObjectRecords,
    canDestroyAllObjectRecords: role.canDestroyAllObjectRecords,
    canAccessAllTools: role.canAccessAllTools,
  };
}

const ALL_OBJECTS_CONFIG: { key: keyof UpdateRoleRequest; label: string; icon: LucideIcon }[] = [
  { key: 'canReadAllObjectRecords', label: 'See Records on All Objects', icon: Eye },
  { key: 'canUpdateAllObjectRecords', label: 'Edit Records on All Objects', icon: Pencil },
  { key: 'canSoftDeleteAllObjectRecords', label: 'Delete Records on All Objects', icon: Trash },
  { key: 'canDestroyAllObjectRecords', label: 'Destroy Records on All Objects', icon: Flame },
  { key: 'canAccessAllTools', label: 'Access All Tools', icon: Wrench },
];

const SETTINGS_FLAG_CONFIG: { flag: PermissionFlagType; label: string; description: string; icon: LucideIcon }[] = [
  { flag: PermissionFlagType.WORKSPACE, label: 'Workspace', description: 'Set global workspace preferences', icon: SettingsIcon },
  { flag: PermissionFlagType.WORKSPACE_MEMBERS, label: 'Members', description: 'Invite, remove, and manage members', icon: Users },
  { flag: PermissionFlagType.ROLES, label: 'Roles', description: 'Define roles and access levels', icon: Lock },
  { flag: PermissionFlagType.DATA_MODEL, label: 'Data Model', description: 'Edit objects, fields, and relations', icon: Database },
  { flag: PermissionFlagType.SECURITY, label: 'Security', description: 'View audit logs and manage security', icon: KeyRound },
  { flag: PermissionFlagType.API_KEYS_AND_WEBHOOKS, label: 'API & Webhooks', description: 'Manage API keys and webhooks', icon: Plug },
  { flag: PermissionFlagType.LAYOUTS, label: 'Layouts', description: 'Customize record page layouts', icon: SettingsIcon },
  { flag: PermissionFlagType.WORKFLOWS, label: 'Workflows', description: 'Build and manage workflows', icon: Workflow },
  { flag: PermissionFlagType.VIEWS, label: 'Views', description: 'Create and edit saved views', icon: Table2 },
  { flag: PermissionFlagType.IMPORT_CSV, label: 'Import CSV', description: 'Bulk-import records from CSV', icon: Upload },
  { flag: PermissionFlagType.EXPORT_CSV, label: 'Export CSV', description: 'Export records to CSV', icon: Download },
];

function AllObjectsCard({ roleId }: { roleId: string }) {
  const queryClient = useQueryClient();
  const { data: role } = useQuery({ queryKey: ['role', roleId], queryFn: () => roleApi.get(roleId) });

  const save = useMutation({
    mutationFn: (input: UpdateRoleRequest) => roleApi.update(roleId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['role', roleId] }),
  });

  if (!role) return null;

  function toggle(key: keyof UpdateRoleRequest, value: boolean): void {
    if (!role) return;
    save.mutate({ ...roleToUpdateInput(role), [key]: value });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">All Objects</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ALL_OBJECTS_CONFIG.map(({ key, label, icon: Icon }) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={Boolean(role[key])}
              disabled={!role.isEditable}
              onCheckedChange={(checked) => toggle(key, checked === true)}
            />
            <Icon className="size-4 text-muted-foreground" />
            {label}
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

/** Summary of a configured object's resolved (override ?? blanket) access, for the compact list row. */
function summarizePermission(role: RoleDetail, object: { canRead: boolean | null; canUpdate: boolean | null; canSoftDelete: boolean | null; canDestroy: boolean | null }): string {
  const parts: string[] = [];
  if ((object.canRead ?? role.canReadAllObjectRecords)) parts.push('See');
  if ((object.canUpdate ?? role.canUpdateAllObjectRecords)) parts.push('Edit');
  if ((object.canSoftDelete ?? role.canSoftDeleteAllObjectRecords)) parts.push('Delete');
  if ((object.canDestroy ?? role.canDestroyAllObjectRecords)) parts.push('Destroy');
  return parts.length > 0 ? parts.join(', ') : 'No access';
}

function ObjectLevelCard({ roleId }: { roleId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: role } = useQuery({ queryKey: ['role', roleId], queryFn: () => roleApi.get(roleId) });
  const { data: objects } = useQuery({
    queryKey: ['object-permissions', roleId],
    queryFn: () => roleApi.listObjectPermissions(roleId),
  });

  const remove = useMutation({
    mutationFn: (objectMetadataId: string) => roleApi.removeObjectPermission(roleId, objectMetadataId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['object-permissions', roleId] }),
  });

  if (!role) return null;
  const overridden = objects?.filter((o) => o.hasOverride) ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Object-Level</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/settings/roles/${roleId}/add-object-permission`)}>
          <Plus className="size-4" /> Add rule
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {overridden.length === 0 && (
          <p className="text-sm text-muted-foreground">No permissions have been set for individual objects.</p>
        )}
        {overridden.map((object) => {
          const ObjectIcon = getIcon(object.icon);
          return (
            <div key={object.objectMetadataId} className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-medium hover:underline"
                onClick={() => navigate(`/settings/roles/${roleId}/object/${object.objectMetadataId}`)}
              >
                <ObjectIcon className="size-4 text-muted-foreground" />
                {object.objectLabel}
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{summarizePermission(role, object)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Remove rule"
                  onClick={() => remove.mutate(object.objectMetadataId)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SettingsPermissionsCard({ roleId }: { roleId: string }) {
  const queryClient = useQueryClient();
  const { data: flags } = useQuery({
    queryKey: ['role-settings-permissions', roleId],
    queryFn: () => roleApi.getSettingsPermissions(roleId),
  });
  const { data: role } = useQuery({ queryKey: ['role', roleId], queryFn: () => roleApi.get(roleId) });

  const saveFlags = useMutation({
    mutationFn: (next: string[]) => roleApi.updateSettingsPermissions(roleId, next),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['role-settings-permissions', roleId] }),
  });
  const saveAllAccess = useMutation({
    mutationFn: (checked: boolean) => roleApi.update(roleId, { ...roleToUpdateInput(role!), canUpdateAllSettings: checked }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['role', roleId] }),
  });

  if (!flags || !role) return null;

  function toggleFlag(flag: string, checked: boolean): void {
    saveFlags.mutate(checked ? [...flags!, flag] : flags!.filter((f) => f !== flag));
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <SettingsIcon className="size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Settings All Access</p>
              <p className="text-xs text-muted-foreground">Ability to edit all settings</p>
            </div>
          </div>
          <Switch
            checked={role.canUpdateAllSettings}
            disabled={!role.isEditable}
            onCheckedChange={(checked) => saveAllAccess.mutate(checked)}
          />
        </div>

        <div className="divide-y rounded-lg border">
          {SETTINGS_FLAG_CONFIG.map(({ flag, label, description, icon: Icon }) => (
            <div key={flag} className="flex items-center justify-between gap-4 p-3">
              <div className="flex items-center gap-3">
                <Icon className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
              <Checkbox
                checked={role.canUpdateAllSettings || flags.includes(flag)}
                disabled={role.canUpdateAllSettings || !role.isEditable}
                onCheckedChange={(checked) => toggleFlag(flag, checked === true)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AssignmentTab({ roleId }: { roleId: string }) {
  const queryClient = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: roleMembers } = useQuery({ queryKey: ['role-members', roleId], queryFn: () => roleApi.listMembers(roleId) });
  const { data: allMembers } = useQuery({ queryKey: ['members'], queryFn: memberApi.list });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: roleApi.list });
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: meApi.get });

  const assign = useMutation({
    mutationFn: (memberId: string) => memberApi.updateRole(memberId, roleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['role-members', roleId] });
      void queryClient.invalidateQueries({ queryKey: ['members'] });
      void queryClient.invalidateQueries({ queryKey: ['role', roleId] });
      setPendingTarget(null);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  // Members can't reassign their own role, and there's no point offering someone already here.
  const assignableMembers = (allMembers ?? []).filter((m) => m.userId !== me?.id && m.roleId !== roleId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assigned members</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger
            render={
              <Button type="button" variant="outline">
                <Search className="size-4" /> Add member
              </Button>
            }
          />
          <PopoverContent className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Search members…" />
              <CommandList>
                <CommandEmpty>No members found.</CommandEmpty>
                <CommandGroup>
                  {assignableMembers.map((member) => (
                    <CommandItem
                      key={member.id}
                      value={`${member.firstName} ${member.lastName} ${member.email}`}
                      onSelect={() => {
                        setPendingTarget(member);
                        setSearchOpen(false);
                      }}
                    >
                      {`${member.firstName} ${member.lastName}`.trim() || member.email}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="divide-y rounded-lg border">
          {roleMembers?.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No members have this role yet.</p>
          )}
          {roleMembers?.map((member) => (
            <div key={member.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {`${member.firstName} ${member.lastName}`.trim() || member.email}
                </p>
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={pendingTarget !== null} onOpenChange={(open) => !open && setPendingTarget(null)}>
        <DialogContent>
          {pendingTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Change role for {pendingTarget.email}?</DialogTitle>
                <DialogDescription>
                  {pendingTarget.roleId
                    ? `They currently have the "${roles?.find((r) => r.id === pendingTarget.roleId)?.label ?? 'Unknown'}" role. This will replace it.`
                    : "This member doesn't have a role yet."}
                </DialogDescription>
              </DialogHeader>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button onClick={() => assign.mutate(pendingTarget.id)} disabled={assign.isPending}>
                  Confirm
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SettingsTab({ roleId }: { roleId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: role } = useQuery({ queryKey: ['role', roleId], queryFn: () => roleApi.get(roleId) });
  const [error, setError] = useState<string | null>(null);

  const form = useForm<UpdateRoleRequest>({
    resolver: zodResolver(updateRoleRequestSchema),
    values: role ?? undefined,
  });

  const save = useMutation({
    mutationFn: (values: UpdateRoleRequest) => roleApi.update(roleId, { ...role!, ...values }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['role', roleId] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const saveIcon = useMutation({
    mutationFn: (icon: string) => roleApi.update(roleId, { ...roleToUpdateInput(role!), icon }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['role', roleId] }),
  });

  const remove = useMutation({
    mutationFn: () => roleApi.remove(roleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
      navigate('/settings/members', { replace: true });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  if (!role) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Details
            {!role.isEditable && <Badge variant="secondary">Built-in</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => save.mutate(values))} className="max-w-sm space-y-4">
              <div className="space-y-2">
                <FormLabel>Icon</FormLabel>
                <div>
                  <IconPicker
                    value={role.icon}
                    options={ROLE_ICON_OPTIONS}
                    onChange={(icon) => saveIcon.mutate(icon)}
                  />
                </div>
              </div>
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!role.isEditable} />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ''} disabled={!role.isEditable} />
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
              {role.isEditable && (
                <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>
                  Save
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      {role.isEditable && (
        <Card>
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog>
              <DialogTrigger render={<Button variant="destructive">Delete role</Button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete {role.label}?</DialogTitle>
                  <DialogDescription>
                    {role.memberCount > 0
                      ? `${role.memberCount} member(s) will be moved to the workspace's default role.`
                      : "This role isn't assigned to anyone."}
                  </DialogDescription>
                </DialogHeader>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <DialogFooter>
                  <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
                    Delete role
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: role } = useQuery({ queryKey: ['role', id], queryFn: () => roleApi.get(id!), enabled: !!id });

  if (!id || !role) return null;

  const RoleIcon = getIcon(role.icon);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <RoleIcon className="size-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-medium">{role.label}</h1>
          <p className="text-sm text-muted-foreground">
            {role.memberCount} member{role.memberCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <Tabs defaultValue="permissions">
        <TabsList>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="assignment">Assignment</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="permissions" className="space-y-8">
          <div>
            <h2 className="text-base font-medium">Objects</h2>
            <p className="text-sm text-muted-foreground">Objects and fields permissions settings</p>
            <div className="mt-4 space-y-4">
              <AllObjectsCard roleId={id} />
              <ObjectLevelCard roleId={id} />
            </div>
          </div>
          <div>
            <h2 className="text-base font-medium">Settings</h2>
            <p className="text-sm text-muted-foreground">Settings permissions</p>
            <div className="mt-4">
              <SettingsPermissionsCard roleId={id} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="assignment">
          <AssignmentTab roleId={id} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab roleId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
