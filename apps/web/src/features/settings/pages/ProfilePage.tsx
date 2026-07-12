import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { updateProfileRequestSchema, changePasswordRequestSchema, type UpdateProfileRequest } from '@saasly/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiError, meApi, resolveFileUrl, workspaceApi } from '@/lib/api-client';
import { useAuthSession } from '@/lib/auth-session';
import { TwoFactorCard } from './TwoFactorCard';

function initialsOf(firstName: string, lastName: string, email: string): string {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.trim();
  return (initials || email.charAt(0) || '?').toUpperCase();
}

function AvatarSection({
  firstName,
  lastName,
  email,
  avatarUrl,
  canEdit,
}: {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => meApi.uploadAvatar(file),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['me'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Upload failed'),
  });
  const remove = useMutation({
    mutationFn: meApi.removeAvatar,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['me'] }),
  });

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        {avatarUrl && <AvatarImage src={resolveFileUrl(avatarUrl) ?? undefined} alt={email} />}
        <AvatarFallback className="text-lg">{initialsOf(firstName, lastName, email)}</AvatarFallback>
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
          <Button type="button" variant="outline" size="sm" disabled={!canEdit} onClick={() => fileInputRef.current?.click()}>
            Upload
          </Button>
          {avatarUrl && canEdit && (
            <Button type="button" variant="ghost" size="sm" onClick={() => remove.mutate()}>
              Remove
            </Button>
          )}
        </div>
        {!canEdit && <p className="text-xs text-muted-foreground">Editing your picture is disabled by your workspace.</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function NameForm({
  firstName,
  lastName,
  canEditFirstName,
  canEditLastName,
}: {
  firstName: string;
  lastName: string;
  canEditFirstName: boolean;
  canEditLastName: boolean;
}) {
  const queryClient = useQueryClient();
  const form = useForm<UpdateProfileRequest>({
    resolver: zodResolver(updateProfileRequestSchema),
    values: { firstName, lastName },
  });

  const update = useMutation({
    mutationFn: (values: UpdateProfileRequest) => meApi.update(values.firstName, values.lastName),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['me'] }),
  });

  const nothingEditable = !canEditFirstName && !canEditLastName;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => update.mutate(values))} className="flex items-end gap-3">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First name</FormLabel>
              <FormControl>
                <Input {...field} disabled={!canEditFirstName} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last name</FormLabel>
              <FormControl>
                <Input {...field} disabled={!canEditLastName} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={update.isPending || !form.formState.isDirty || nothingEditable}>
          Save
        </Button>
      </form>
    </Form>
  );
}

const changePasswordFormSchema = changePasswordRequestSchema;
type ChangePasswordForm = z.infer<typeof changePasswordFormSchema>;

function ChangePasswordForm() {
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const change = useMutation({
    mutationFn: (values: ChangePasswordForm) => meApi.changePassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      setStatus('success');
      setError(null);
      form.reset();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => change.mutate(values))} className="max-w-sm space-y-4">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
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
        {status === 'success' && (
          <Alert>
            <AlertDescription>Password changed.</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={change.isPending}>
          Change password
        </Button>
      </form>
    </Form>
  );
}

function DeleteAccountDialog() {
  const navigate = useNavigate();
  const { clearSession } = useAuthSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = useMutation({
    mutationFn: () => meApi.deleteAccount(password),
    onSuccess: () => {
      clearSession();
      navigate('/login', { replace: true });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive">Delete account</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account</DialogTitle>
          <DialogDescription>
            This permanently deletes your account and workspace memberships. This can't be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-password">Confirm your password</Label>
          <Input
            id="delete-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={!password || deleteAccount.isPending}
            onClick={() => deleteAccount.mutate()}
          >
            Permanently delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProfilePage() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: meApi.get });
  const { data: workspace } = useQuery({ queryKey: ['workspace'], queryFn: workspaceApi.getCurrent });

  if (!me) return null;

  const editable = workspace?.editableProfileFields ?? ['firstName', 'lastName', 'profilePicture'];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-medium">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your personal account settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Picture</CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarSection
            firstName={me.firstName}
            lastName={me.lastName}
            email={me.email}
            avatarUrl={me.avatarUrl}
            canEdit={editable.includes('profilePicture')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Name</CardTitle>
        </CardHeader>
        <CardContent>
          <NameForm
            firstName={me.firstName}
            lastName={me.lastName}
            canEditFirstName={editable.includes('firstName')}
            canEditLastName={editable.includes('lastName')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <span className="text-sm">{me.email}</span>
          <Badge variant={me.isEmailVerified ? 'default' : 'secondary'}>
            {me.isEmailVerified ? 'Verified' : 'Unverified'}
          </Badge>
        </CardContent>
      </Card>

      <TwoFactorCard enabled={me.twoFactorEnabled} />

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>Permanently delete your account.</CardDescription>
        </CardHeader>
        <CardFooter>
          <DeleteAccountDialog />
        </CardFooter>
      </Card>
    </div>
  );
}
