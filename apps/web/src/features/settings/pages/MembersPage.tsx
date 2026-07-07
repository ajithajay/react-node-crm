import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createInvitationRequestSchema, type CreateInvitationRequest } from '@saasly/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError, type Member, type Role, invitationApi, memberApi, resolveFileUrl, roleApi } from '@/lib/api-client';
import { RolesTab } from './RolesTab';

function initialsOf(firstName: string, lastName: string, email: string): string {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.trim();
  return (initials || email.charAt(0) || '?').toUpperCase();
}

function roleLabel(roles: Role[] | undefined, roleId: string | null): string {
  return roles?.find((r) => r.id === roleId)?.label ?? '—';
}

function MemberDetailDialog({
  member,
  roles,
  onClose,
}: {
  member: Member | null;
  roles: Role[] | undefined;
  onClose: () => void;
}) {
  const fullName = member ? `${member.firstName} ${member.lastName}`.trim() : '';

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {member && (
          <>
            <DialogHeader>
              <DialogTitle>{fullName || member.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-12">
                  {member.avatarUrl && <AvatarImage src={resolveFileUrl(member.avatarUrl) ?? undefined} alt={fullName} />}
                  <AvatarFallback>{initialsOf(member.firstName, member.lastName, member.email)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{fullName || '—'}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="text-sm">{roleLabel(roles, member.roleId)}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Object- and field-level permission enforcement applies once record CRUD ships (Phase 6).
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TeamTab() {
  const { data: members, isLoading } = useQuery({ queryKey: ['members'], queryFn: memberApi.list });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: roleApi.list });
  const [selected, setSelected] = useState<Member | null>(null);

  return (
    <div className="divide-y rounded-lg border">
      {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
      {members?.map((member) => {
        const fullName = `${member.firstName} ${member.lastName}`.trim();
        return (
          <button
            key={member.id}
            type="button"
            onClick={() => setSelected(member)}
            className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
          >
            <Avatar className="size-8">
              {member.avatarUrl && <AvatarImage src={resolveFileUrl(member.avatarUrl) ?? undefined} alt={fullName} />}
              <AvatarFallback>{initialsOf(member.firstName, member.lastName, member.email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{fullName || member.email}</p>
              <p className="truncate text-xs text-muted-foreground">{member.email}</p>
            </div>
            <Badge variant="secondary">{roleLabel(roles, member.roleId)}</Badge>
          </button>
        );
      })}
      <MemberDetailDialog member={selected} roles={roles} onClose={() => setSelected(null)} />
    </div>
  );
}

const NO_ROLE_SELECTED = 'default';

function InviteTab() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data: invitations } = useQuery({ queryKey: ['invitations'], queryFn: invitationApi.list });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: roleApi.list });

  const form = useForm<CreateInvitationRequest>({
    resolver: zodResolver(createInvitationRequestSchema),
    defaultValues: { email: '', roleId: undefined },
  });

  const invite = useMutation({
    mutationFn: (values: CreateInvitationRequest) => invitationApi.create(values),
    onSuccess: () => {
      setError(null);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const resend = useMutation({
    mutationFn: (id: string) => invitationApi.resend(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => invitationApi.revoke(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  });

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit((values) => invite.mutate(values))} className="flex items-end gap-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Invite by email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="teammate@company.com" {...field} />
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
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_ROLE_SELECTED}>Default role</SelectItem>
                    {roles?.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <Button type="submit" disabled={invite.isPending}>
            Send invite
          </Button>
        </form>
      </Form>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="divide-y rounded-lg border">
        {invitations?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No invitations yet.</p>}
        {invitations?.map((invitation) => (
          <div key={invitation.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{invitation.email}</p>
              <p className="text-xs text-muted-foreground">
                {invitation.roleId ? roleLabel(roles, invitation.roleId) : 'Default role'} · Expires{' '}
                {new Date(invitation.expiresAt).toLocaleDateString()}
              </p>
            </div>
            <Badge variant={invitation.status === 'PENDING' ? 'default' : 'secondary'}>{invitation.status}</Badge>
            {invitation.status === 'PENDING' && (
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => resend.mutate(invitation.id)}>
                  Resend
                </Button>
                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(invitation.id)}>
                  Revoke
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MembersPage() {
  return (
    <div>
      <h1 className="text-lg font-medium">Members</h1>
      <p className="mt-1 text-sm text-muted-foreground">Team and pending invitations.</p>

      <Tabs defaultValue="team" className="mt-4">
        <TabsList>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="invite">Invite</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>
        <TabsContent value="team">
          <TeamTab />
        </TabsContent>
        <TabsContent value="invite">
          <InviteTab />
        </TabsContent>
        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
