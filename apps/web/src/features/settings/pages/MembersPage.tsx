import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { memberApi } from '@/lib/api-client';

function initialsOf(firstName: string, lastName: string, email: string): string {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.trim();
  return (initials || email.charAt(0) || '?').toUpperCase();
}

export function MembersPage() {
  const { data: members, isLoading } = useQuery({ queryKey: ['members'], queryFn: memberApi.list });

  return (
    <div>
      <h1 className="text-lg font-medium">Team</h1>
      <p className="mt-1 text-sm text-muted-foreground">Members of this workspace.</p>

      <div className="mt-4 divide-y rounded-lg border">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {members?.map((member) => {
          const fullName = `${member.firstName} ${member.lastName}`.trim();
          return (
            <div key={member.id} className="flex items-center gap-3 p-3">
              <Avatar className="size-8">
                {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={fullName} />}
                <AvatarFallback>{initialsOf(member.firstName, member.lastName, member.email)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{fullName || member.email}</p>
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">Inviting members is coming in Phase 5d.</p>
    </div>
  );
}
