import { ChevronsUpDown, LogOut, Settings, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authApi, resolveFileUrl, type Me } from '@/lib/api-client';
import { useAuthSession } from '@/lib/auth-session';

function initialsOf(firstName: string, lastName: string, email: string): string {
  const fromName = `${firstName.charAt(0)}${lastName.charAt(0)}`.trim();
  return (fromName || email.charAt(0)).toUpperCase() || '?';
}

export function UserMenu({ me }: { me: Me | undefined }) {
  const navigate = useNavigate();
  const { clearSession } = useAuthSession();
  const name = me ? `${me.firstName} ${me.lastName}`.trim() || me.email : 'Loading…';

  async function handleLogout(): Promise<void> {
    await authApi.logout().catch(() => undefined);
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="h-9 gap-2 px-2">
            <Avatar className="size-6">
              {me?.avatarUrl && <AvatarImage src={resolveFileUrl(me.avatarUrl) ?? undefined} alt={name} />}
              <AvatarFallback>{me ? initialsOf(me.firstName, me.lastName, me.email) : '?'}</AvatarFallback>
            </Avatar>
            <span className="max-w-40 truncate text-sm font-medium">{name}</span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => navigate('/settings/members')}>
          <UserPlus /> Invite user
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/settings')}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} variant="destructive">
          <LogOut /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
