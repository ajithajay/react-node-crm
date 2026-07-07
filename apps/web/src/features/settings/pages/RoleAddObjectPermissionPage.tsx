import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getIcon } from '@/lib/icons';
import { type ObjectPermission, roleApi } from '@/lib/api-client';

function ObjectRow({ object, onSelect }: { object: ObjectPermission; onSelect: () => void }) {
  const Icon = getIcon(object.icon);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm hover:bg-muted/50"
    >
      <span className="flex items-center gap-2 font-medium">
        <Icon className="size-4 text-muted-foreground" />
        {object.objectLabel}
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}

export function RoleAddObjectPermissionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data: role } = useQuery({ queryKey: ['role', id], queryFn: () => roleApi.get(id!), enabled: !!id });
  const { data: objects } = useQuery({
    queryKey: ['object-permissions', id],
    queryFn: () => roleApi.listObjectPermissions(id!),
    enabled: !!id,
  });

  if (!id || !role) return null;

  const query = search.trim().toLowerCase();
  const candidates = (objects ?? []).filter(
    (o) => !o.hasOverride && (query === '' || o.objectLabel.toLowerCase().includes(query)),
  );
  const standard = candidates.filter((o) => !o.isCustom);
  const custom = candidates.filter((o) => o.isCustom);

  function select(objectMetadataId: string): void {
    navigate(`/settings/roles/${id}/object/${objectMetadataId}`);
  }

  return (
    <div className="max-w-lg space-y-6">
      <button
        type="button"
        onClick={() => navigate(`/settings/roles/${id}`)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {role.label}
      </button>

      <div>
        <h1 className="text-lg font-medium">1. Select an object</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search an object…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {standard.length > 0 && (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Standard</p>
            <p className="text-xs text-muted-foreground">All the standard objects</p>
          </div>
          <Card>
            <CardContent className="grid gap-2 pt-6 sm:grid-cols-2">
              {standard.map((object) => (
                <ObjectRow key={object.objectMetadataId} object={object} onSelect={() => select(object.objectMetadataId)} />
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {custom.length > 0 && (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Custom</p>
            <p className="text-xs text-muted-foreground">All your custom objects</p>
          </div>
          <Card>
            <CardContent className="grid gap-2 pt-6 sm:grid-cols-2">
              {custom.map((object) => (
                <ObjectRow key={object.objectMetadataId} object={object} onSelect={() => select(object.objectMetadataId)} />
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {standard.length === 0 && custom.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {objects && objects.length > 0
            ? 'Every object already has a rule for this role.'
            : 'No objects found.'}
        </p>
      )}
    </div>
  );
}
