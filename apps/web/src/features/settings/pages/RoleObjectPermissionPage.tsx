import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Eye, Flame, Pencil, Search, Trash, type LucideIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { deriveOverridableCheckbox, OverridableCheckbox } from '@/components/OverridableCheckbox';
import { getIcon } from '@/lib/icons';

const FIELD_TYPE_LABEL: Record<string, string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  BOOLEAN: 'Boolean',
  DATE_TIME: 'Date and Time',
  DATE: 'Date',
  SELECT: 'Select',
  MULTI_SELECT: 'Multi-Select',
  RATING: 'Rating',
  FILES: 'Files',
  CURRENCY: 'Currency',
  EMAILS: 'Emails',
  LINKS: 'Links',
  PHONES: 'Phones',
  FULL_NAME: 'Full Name',
  ADDRESS: 'Address',
  RICH_TEXT: 'Rich Text',
  RELATION: 'Relation',
  MORPH_RELATION: 'Relation',
  RAW_JSON: 'Raw JSON',
  ARRAY: 'Array',
  UUID: 'UUID',
};
import {
  ApiError,
  type FieldPermission,
  type RoleDetail,
  roleApi,
} from '@/lib/api-client';

type ObjectLevelKey = 'canRead' | 'canUpdate' | 'canSoftDelete' | 'canDestroy';

const OBJECT_LEVEL_CONFIG: {
  key: ObjectLevelKey;
  label: string;
  verb: string;
  rootFlag: keyof RoleDetail;
  icon: LucideIcon;
}[] = [
  { key: 'canRead', label: 'See', verb: 'see', rootFlag: 'canReadAllObjectRecords', icon: Eye },
  { key: 'canUpdate', label: 'Edit', verb: 'edit', rootFlag: 'canUpdateAllObjectRecords', icon: Pencil },
  { key: 'canSoftDelete', label: 'Delete', verb: 'delete', rootFlag: 'canSoftDeleteAllObjectRecords', icon: Trash },
  { key: 'canDestroy', label: 'Destroy', verb: 'destroy', rootFlag: 'canDestroyAllObjectRecords', icon: Flame },
];

export function RoleObjectPermissionPage() {
  const { id, objectMetadataId } = useParams<{ id: string; objectMetadataId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fieldSearch, setFieldSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: role } = useQuery({ queryKey: ['role', id], queryFn: () => roleApi.get(id!), enabled: !!id });
  const { data: objects } = useQuery({
    queryKey: ['object-permissions', id],
    queryFn: () => roleApi.listObjectPermissions(id!),
    enabled: !!id,
  });
  const { data: fields } = useQuery({
    queryKey: ['field-permissions', id, objectMetadataId],
    queryFn: () => roleApi.listFieldPermissions(id!, objectMetadataId!),
    enabled: !!id && !!objectMetadataId,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['object-permissions', id] });
    void queryClient.invalidateQueries({ queryKey: ['field-permissions', id, objectMetadataId] });
  };

  const patchObject = useMutation({
    mutationFn: (patch: Partial<Record<ObjectLevelKey, boolean | null>>) =>
      roleApi.updateObjectPermission(id!, objectMetadataId!, patch),
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const patchField = useMutation({
    mutationFn: ({ fieldMetadataId, ...patch }: { fieldMetadataId: string; canRead?: false | null; canUpdate?: false | null }) =>
      roleApi.updateFieldPermission(id!, fieldMetadataId, patch),
    onSuccess: () => invalidate(),
  });

  if (!id || !objectMetadataId || !role || !objects) return null;

  const object = objects.find((o) => o.objectMetadataId === objectMetadataId);
  if (!object) return null;

  const ObjectIcon = getIcon(object.icon);

  const resolvedRead = object.canRead ?? role.canReadAllObjectRecords;
  const resolvedUpdate = object.canUpdate ?? role.canUpdateAllObjectRecords;

  const query = fieldSearch.trim().toLowerCase();
  const visibleFields = (fields ?? []).filter((f) => query === '' || f.fieldLabel.toLowerCase().includes(query));

  function setLevel(key: ObjectLevelKey, value: boolean | null): void {
    patchObject.mutate({ [key]: value });
  }

  function setFieldRead(field: FieldPermission, restrict: boolean): void {
    patchField.mutate({ fieldMetadataId: field.fieldMetadataId, canRead: restrict ? false : null });
  }

  function setFieldUpdate(field: FieldPermission, restrict: boolean): void {
    patchField.mutate({ fieldMetadataId: field.fieldMetadataId, canUpdate: restrict ? false : null });
  }

  const restrictableFields = visibleFields.filter((f) => f.isRestrictable);
  const anyReadRestricted = restrictableFields.some((f) => f.canRead === false);
  const anyUpdateRestricted = restrictableFields.some((f) => f.canUpdate === false && f.canRead !== false);

  function bulkSetRead(restrict: boolean): void {
    for (const field of restrictableFields) {
      if (restrict ? field.canRead !== false : field.canRead === false) setFieldRead(field, restrict);
    }
  }

  function bulkSetUpdate(restrict: boolean): void {
    for (const field of restrictableFields) {
      if (field.canRead === false) continue;
      if (restrict ? field.canUpdate !== false : field.canUpdate === false) setFieldUpdate(field, restrict);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <button
        type="button"
        onClick={() => navigate(`/settings/roles/${id}`)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {role.label}
      </button>

      <div className="flex items-center gap-2">
        <ObjectIcon className="size-5 text-muted-foreground" />
        <h1 className="text-lg font-medium">2. Set {object.objectLabel} permissions</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Object-Level</CardTitle>
          <p className="text-xs text-muted-foreground">Actions users can perform on this object</p>
        </CardHeader>
        <CardContent className="divide-y">
          {OBJECT_LEVEL_CONFIG.map(({ key, label, verb, rootFlag, icon: Icon }) => {
            const blanket = Boolean(role[rootFlag]);
            const override = object[key];
            const { visual } = deriveOverridableCheckbox(blanket, override);
            const helperText =
              visual === 'default'
                ? `This role can ${verb} all records`
                : visual === 'override'
                  ? 'Revoked for this object'
                  : override === true
                    ? 'Granted for this object'
                    : undefined;

            return (
              <div key={key} className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-3">
                  <Icon className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{label} {object.objectLabel}</p>
                    {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
                  </div>
                </div>
                <OverridableCheckbox
                  blanket={blanket}
                  override={override}
                  onToggle={(checked) => setLevel(key, checked)}
                  onRevoke={() => setLevel(key, false)}
                  onReset={() => setLevel(key, null)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {resolvedRead ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fields Permissions</CardTitle>
            <p className="text-xs text-muted-foreground">Ability to interact with this object's fields.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search a field…"
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
              />
            </div>

            <div className="rounded-lg border">
              <div className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-4 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>Name</span>
                <span>Data type</span>
                <span>See</span>
                {resolvedUpdate ? <span>Edit</span> : <span />}
              </div>
              <div className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-4 border-b bg-muted/20 px-3 py-2 text-sm">
                <span className="text-muted-foreground">All</span>
                <span />
                <OverridableCheckbox
                  blanket
                  override={anyReadRestricted ? false : null}
                  onToggle={() => {}}
                  onRevoke={() => bulkSetRead(true)}
                  onReset={() => bulkSetRead(false)}
                />
                {resolvedUpdate ? (
                  <OverridableCheckbox
                    blanket
                    override={anyUpdateRestricted ? false : null}
                    onToggle={() => {}}
                    onRevoke={() => bulkSetUpdate(true)}
                    onReset={() => bulkSetUpdate(false)}
                  />
                ) : (
                  <span />
                )}
              </div>
              <div className="divide-y">
                {visibleFields.map((field) => {
                  const FieldIcon = getIcon(field.icon);
                  return (
                    <div
                      key={field.fieldMetadataId}
                      className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-4 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <FieldIcon className="size-4 text-muted-foreground" />
                        {field.fieldLabel}
                      </span>
                      <span className="text-muted-foreground">{FIELD_TYPE_LABEL[field.fieldType] ?? field.fieldType}</span>
                      {field.isRestrictable ? (
                        <OverridableCheckbox
                          blanket
                          override={field.canRead}
                          onToggle={() => {}}
                          onRevoke={() => setFieldRead(field, true)}
                          onReset={() => setFieldRead(field, false)}
                        />
                      ) : (
                        <Checkbox checked disabled />
                      )}
                      {resolvedUpdate ? (
                        field.isRestrictable && field.canRead !== false ? (
                          <OverridableCheckbox
                            blanket
                            override={field.canUpdate}
                            onToggle={() => {}}
                            onRevoke={() => setFieldUpdate(field, true)}
                            onReset={() => setFieldUpdate(field, false)}
                          />
                        ) : field.isRestrictable ? (
                          <span className="text-center text-muted-foreground">—</span>
                        ) : (
                          <Checkbox checked disabled />
                        )
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
                {visibleFields.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">No fields found.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Field permissions are hidden because this role can't see records on this object.
        </p>
      )}
    </div>
  );
}
