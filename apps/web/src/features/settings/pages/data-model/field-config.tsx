import { useEffect, useState } from 'react';
import {
  AlignLeft,
  ArrowLeftRight,
  Braces,
  Calendar,
  CalendarClock,
  CaseSensitive,
  Circle,
  DollarSign,
  Fingerprint,
  GripVertical,
  Hash,
  Link as LinkIcon,
  List,
  Mail,
  MapPin,
  Paperclip,
  Phone,
  Plus,
  Star,
  Tag,
  Tags,
  ToggleLeft,
  User,
  UserCog,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ADDRESS_SUB_FIELDS,
  DEFAULT_VISIBLE_ADDRESS_SUB_FIELDS,
  FieldMetadataType,
  type AddressSubField,
  type CreateFieldRequest,
  type FieldMetadataSettings,
  type SelectOption,
} from '@saasly/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { IconPicker } from '@/components/IconPicker';
import { ApiError, type DataModelField, dataModelApi } from '@/lib/api-client';
import { ROLE_ICON_OPTIONS } from '@/lib/icons';

export const FIELD_TYPE_ICON: Record<string, LucideIcon> = {
  TEXT: CaseSensitive,
  NUMBER: Hash,
  BOOLEAN: ToggleLeft,
  DATE_TIME: CalendarClock,
  DATE: Calendar,
  SELECT: Tag,
  MULTI_SELECT: Tags,
  RATING: Star,
  FILES: Paperclip,
  CURRENCY: DollarSign,
  EMAILS: Mail,
  LINKS: LinkIcon,
  PHONES: Phone,
  FULL_NAME: User,
  ADDRESS: MapPin,
  RICH_TEXT: AlignLeft,
  ACTOR: UserCog,
  RELATION: ArrowLeftRight,
  MORPH_RELATION: ArrowLeftRight,
  RAW_JSON: Braces,
  ARRAY: List,
  UUID: Fingerprint,
};

/** Human-readable data-type label shown in the field table's "Data type" column. */
export const FIELD_TYPE_LABEL: Record<string, string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  BOOLEAN: 'True/False',
  DATE_TIME: 'Date and Time',
  DATE: 'Date',
  SELECT: 'Select',
  MULTI_SELECT: 'Multi-select',
  RATING: 'Rating',
  FILES: 'Files',
  CURRENCY: 'Currency',
  EMAILS: 'Emails',
  LINKS: 'Links',
  PHONES: 'Phones',
  FULL_NAME: 'Full Name',
  ADDRESS: 'Address',
  RICH_TEXT: 'Rich Text',
  ACTOR: 'Actor',
  RELATION: 'Relation',
  MORPH_RELATION: 'Morph Relation',
  RAW_JSON: 'JSON',
  ARRAY: 'Array',
  UUID: 'Unique ID',
};

export const FIELD_TYPE_GROUPS: { title: string; types: { type: string; label: string }[] }[] = [
  {
    title: 'Basic',
    types: [
      { type: FieldMetadataType.TEXT, label: 'Text' },
      { type: FieldMetadataType.NUMBER, label: 'Number' },
      { type: FieldMetadataType.BOOLEAN, label: 'True/False' },
      { type: FieldMetadataType.DATE_TIME, label: 'Date and Time' },
      { type: FieldMetadataType.DATE, label: 'Date' },
      { type: FieldMetadataType.SELECT, label: 'Select' },
      { type: FieldMetadataType.MULTI_SELECT, label: 'Multi-select' },
      { type: FieldMetadataType.RATING, label: 'Rating' },
      { type: FieldMetadataType.FILES, label: 'Files' },
    ],
  },
  {
    title: 'Composite',
    types: [
      { type: FieldMetadataType.CURRENCY, label: 'Currency' },
      { type: FieldMetadataType.EMAILS, label: 'Emails' },
      { type: FieldMetadataType.LINKS, label: 'Links' },
      { type: FieldMetadataType.PHONES, label: 'Phones' },
      { type: FieldMetadataType.FULL_NAME, label: 'Full Name' },
      { type: FieldMetadataType.ADDRESS, label: 'Address' },
      { type: FieldMetadataType.RICH_TEXT, label: 'Rich Text' },
    ],
  },
  {
    title: 'Advanced',
    types: [
      { type: FieldMetadataType.RAW_JSON, label: 'JSON' },
      { type: FieldMetadataType.ARRAY, label: 'Array' },
      { type: FieldMetadataType.UUID, label: 'Unique ID' },
    ],
  },
];

/** SELECT/MULTI_SELECT option colors (Tailwind-friendly names, matching the seed palette). */
export const OPTION_COLORS = [
  'blue',
  'green',
  'yellow',
  'orange',
  'purple',
  'red',
  'gray',
  'pink',
  'sky',
  'teal',
  'lime',
  'amber',
];

const COLOR_SWATCH: Record<string, string> = {
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  purple: '#a855f7',
  red: '#ef4444',
  gray: '#6b7280',
  pink: '#ec4899',
  sky: '#0ea5e9',
  teal: '#14b8a6',
  lime: '#84cc16',
  amber: '#f59e0b',
};

const ADDRESS_SUB_FIELD_LABELS: Record<AddressSubField, string> = {
  street1: 'Address 1',
  street2: 'Address 2',
  city: 'City',
  state: 'State',
  postcode: 'Postcode',
  country: 'Country',
  lat: 'Latitude',
  lng: 'Longitude',
};

// A small country list for the Address / Phones "default country" selects.
const COUNTRIES = [
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'India',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'Netherlands',
  'Singapore',
  'Japan',
  'Brazil',
];

type EditableOption = { value: string; label: string; color: string };

function slugifyValue(label: string): string {
  return (
    label
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'OPTION'
  );
}

/** State shared by the per-type settings form. Kept flat and controlled by the dialog. */
export interface FieldConfigState {
  settings: FieldMetadataSettings;
  options: EditableOption[];
  /** SELECT: a single default option value; MULTI_SELECT: array. Empty = no default. */
  defaultSelect: string[];
  showAdvancedOptions: boolean;
}

export function initialConfigState(field?: DataModelField): FieldConfigState {
  const settings = (field?.settings as FieldMetadataSettings | null) ?? {};
  const options = (settings.options ?? []).map((o) => ({ value: o.value, label: o.label, color: o.color }));
  const rawDefault = field?.defaultValue;
  const defaultSelect = Array.isArray(rawDefault)
    ? (rawDefault as string[])
    : typeof rawDefault === 'string'
      ? [rawDefault]
      : [];
  return {
    settings: {
      numberDataType: settings.numberDataType ?? 'FLOAT',
      isPercentage: settings.isPercentage ?? false,
      decimals: settings.decimals,
      currencyFormat: settings.currencyFormat ?? 'SHORT',
      defaultCurrencyCode: settings.defaultCurrencyCode ?? 'USD',
      dateDisplayFormat: settings.dateDisplayFormat ?? 'RELATIVE',
      customUnicodeDateFormat: settings.customUnicodeDateFormat,
      displayedMaxRows: settings.displayedMaxRows,
      maxRating: settings.maxRating ?? 5,
      addressSubFields: settings.addressSubFields ?? DEFAULT_VISIBLE_ADDRESS_SUB_FIELDS,
      defaultAddressCountry: settings.defaultAddressCountry,
      maxNumberOfValues: settings.maxNumberOfValues,
      defaultPhoneCountryCode: settings.defaultPhoneCountryCode,
    },
    options:
      options.length > 0
        ? options
        : [
            { value: 'OPTION_1', label: 'Option 1', color: 'blue' },
            { value: 'OPTION_2', label: 'Option 2', color: 'green' },
          ],
    defaultSelect,
    showAdvancedOptions: false,
  };
}

/**
 * Build the `settings` + `defaultValue` payload for the create/update-field API from the current
 * config state, given the field type. Only the keys relevant to that type are included.
 */
export function buildFieldPayload(
  type: string,
  state: FieldConfigState,
): { settings: FieldMetadataSettings | undefined; defaultValue: unknown } {
  const s = state.settings;
  switch (type) {
    case FieldMetadataType.TEXT:
      return { settings: s.displayedMaxRows ? { displayedMaxRows: s.displayedMaxRows } : undefined, defaultValue: null };
    case FieldMetadataType.NUMBER:
      return {
        settings: { numberDataType: s.numberDataType, isPercentage: s.isPercentage, decimals: s.decimals },
        defaultValue: null,
      };
    case FieldMetadataType.CURRENCY:
      return {
        settings: { currencyFormat: s.currencyFormat, decimals: s.decimals, defaultCurrencyCode: s.defaultCurrencyCode },
        defaultValue: null,
      };
    case FieldMetadataType.DATE:
    case FieldMetadataType.DATE_TIME:
      return {
        settings: {
          dateDisplayFormat: s.dateDisplayFormat,
          customUnicodeDateFormat: s.dateDisplayFormat === 'CUSTOM' ? s.customUnicodeDateFormat : undefined,
        },
        defaultValue: null,
      };
    case FieldMetadataType.RATING:
      return { settings: { maxRating: s.maxRating }, defaultValue: null };
    case FieldMetadataType.ADDRESS:
      return {
        settings: { addressSubFields: s.addressSubFields, defaultAddressCountry: s.defaultAddressCountry },
        defaultValue: null,
      };
    case FieldMetadataType.PHONES:
      return {
        settings: { maxNumberOfValues: s.maxNumberOfValues, defaultPhoneCountryCode: s.defaultPhoneCountryCode },
        defaultValue: null,
      };
    case FieldMetadataType.FILES:
    case FieldMetadataType.EMAILS:
    case FieldMetadataType.LINKS:
    case FieldMetadataType.ARRAY:
      return { settings: s.maxNumberOfValues ? { maxNumberOfValues: s.maxNumberOfValues } : undefined, defaultValue: null };
    case FieldMetadataType.SELECT:
    case FieldMetadataType.MULTI_SELECT: {
      const options: SelectOption[] = state.options
        .filter((o) => o.label.trim() !== '')
        .map((o, i) => ({ label: o.label.trim(), value: o.value || slugifyValue(o.label), color: o.color, position: i }));
      const isMulti = type === FieldMetadataType.MULTI_SELECT;
      const defaultValue = isMulti
        ? state.defaultSelect
        : (state.defaultSelect[0] ?? null);
      return { settings: { options }, defaultValue };
    }
    default:
      return { settings: undefined, defaultValue: null };
  }
}

/** The per-type configuration controls (shared by create + edit). */
export function FieldTypeSettings({
  type,
  state,
  setState,
}: {
  type: string;
  state: FieldConfigState;
  setState: (updater: (prev: FieldConfigState) => FieldConfigState) => void;
}) {
  const setSettings = (patch: Partial<FieldMetadataSettings>) =>
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  const isSelect = type === FieldMetadataType.SELECT || type === FieldMetadataType.MULTI_SELECT;

  if (type === FieldMetadataType.NUMBER) {
    return (
      <>
        <div className="space-y-2">
          <Label>Number type</Label>
          <Select value={state.settings.numberDataType} onValueChange={(v) => v && setSettings({ numberDataType: v as 'FLOAT' | 'INT' | 'BIGINT' })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FLOAT">Decimal</SelectItem>
              <SelectItem value="INT">Integer</SelectItem>
              <SelectItem value="BIGINT">Big integer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {state.settings.numberDataType === 'FLOAT' && (
          <div className="space-y-2">
            <Label>Number of decimals</Label>
            <Input
              type="number"
              min={0}
              max={10}
              value={state.settings.decimals ?? ''}
              onChange={(e) => setSettings({ decimals: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={state.settings.isPercentage ?? false} onCheckedChange={(c) => setSettings({ isPercentage: c === true })} />
          Display as percentage
        </label>
      </>
    );
  }

  if (type === FieldMetadataType.CURRENCY) {
    return (
      <>
        <div className="space-y-2">
          <Label>Default currency</Label>
          <Select value={state.settings.defaultCurrencyCode} onValueChange={(v) => v && setSettings({ defaultCurrencyCode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'SGD'].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Display format</Label>
          <Select value={state.settings.currencyFormat} onValueChange={(v) => v && setSettings({ currencyFormat: v as 'SHORT' | 'FULL' })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SHORT">Short (1.2k)</SelectItem>
              <SelectItem value="FULL">Full (1,200.00)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  if (type === FieldMetadataType.DATE || type === FieldMetadataType.DATE_TIME) {
    return (
      <>
        <div className="space-y-2">
          <Label>Display format</Label>
          <Select value={state.settings.dateDisplayFormat} onValueChange={(v) => v && setSettings({ dateDisplayFormat: v as 'RELATIVE' | 'USER_SETTINGS' | 'CUSTOM' })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="RELATIVE">Relative (2 days ago)</SelectItem>
              <SelectItem value="USER_SETTINGS">Default (from your settings)</SelectItem>
              <SelectItem value="CUSTOM">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {state.settings.dateDisplayFormat === 'CUSTOM' && (
          <div className="space-y-2">
            <Label>Custom format</Label>
            <Input
              placeholder="e.g. d MMM yyyy"
              value={state.settings.customUnicodeDateFormat ?? ''}
              onChange={(e) => setSettings({ customUnicodeDateFormat: e.target.value })}
            />
          </div>
        )}
      </>
    );
  }

  if (type === FieldMetadataType.RATING) {
    return (
      <div className="space-y-2">
        <Label>Max rating</Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={state.settings.maxRating ?? 5}
          onChange={(e) => setSettings({ maxRating: Number(e.target.value) })}
        />
      </div>
    );
  }

  if (type === FieldMetadataType.TEXT) {
    return (
      <div className="space-y-2">
        <Label>Displayed max rows</Label>
        <Input
          type="number"
          min={1}
          placeholder="1"
          value={state.settings.displayedMaxRows ?? ''}
          onChange={(e) => setSettings({ displayedMaxRows: e.target.value === '' ? undefined : Number(e.target.value) })}
        />
      </div>
    );
  }

  if (type === FieldMetadataType.ADDRESS) {
    const selected = new Set(state.settings.addressSubFields ?? DEFAULT_VISIBLE_ADDRESS_SUB_FIELDS);
    return (
      <>
        <div className="space-y-2">
          <Label>Default country</Label>
          <Select
            value={state.settings.defaultAddressCountry ?? '__none'}
            onValueChange={(v) => setSettings({ defaultAddressCountry: v && v !== '__none' ? v : undefined })}
          >
            <SelectTrigger><SelectValue placeholder="No country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No country</SelectItem>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sub-fields</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {ADDRESS_SUB_FIELDS.map((sub) => (
              <label key={sub} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.has(sub)}
                  onCheckedChange={(c) => {
                    const next = new Set(selected);
                    if (c === true) next.add(sub);
                    else next.delete(sub);
                    setSettings({ addressSubFields: ADDRESS_SUB_FIELDS.filter((f) => next.has(f)) });
                  }}
                />
                {ADDRESS_SUB_FIELD_LABELS[sub]}
              </label>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (type === FieldMetadataType.PHONES) {
    return (
      <div className="space-y-2">
        <Label>Max number of phones</Label>
        <Input
          type="number"
          min={1}
          placeholder="Unlimited"
          value={state.settings.maxNumberOfValues ?? ''}
          onChange={(e) => setSettings({ maxNumberOfValues: e.target.value === '' ? undefined : Number(e.target.value) })}
        />
      </div>
    );
  }

  if (
    type === FieldMetadataType.FILES ||
    type === FieldMetadataType.EMAILS ||
    type === FieldMetadataType.LINKS ||
    type === FieldMetadataType.ARRAY
  ) {
    return (
      <div className="space-y-2">
        <Label>Max number of values</Label>
        <Input
          type="number"
          min={1}
          placeholder="Unlimited"
          value={state.settings.maxNumberOfValues ?? ''}
          onChange={(e) => setSettings({ maxNumberOfValues: e.target.value === '' ? undefined : Number(e.target.value) })}
        />
      </div>
    );
  }

  if (isSelect) {
    const isMulti = type === FieldMetadataType.MULTI_SELECT;
    const toggleDefault = (value: string) =>
      setState((prev) => {
        if (isMulti) {
          const has = prev.defaultSelect.includes(value);
          return { ...prev, defaultSelect: has ? prev.defaultSelect.filter((v) => v !== value) : [...prev.defaultSelect, value] };
        }
        return { ...prev, defaultSelect: prev.defaultSelect[0] === value ? [] : [value] };
      });

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Options</Label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox
              checked={state.showAdvancedOptions}
              onCheckedChange={(c) => setState((prev) => ({ ...prev, showAdvancedOptions: c === true }))}
            />
            Edit API values
          </label>
        </div>
        <div className="space-y-2">
          {state.options.map((option, i) => {
            const isDefault = state.defaultSelect.includes(option.value);
            return (
              <div key={i} className="space-y-1 rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                  <Select
                    value={option.color}
                    onValueChange={(v) =>
                      v && setState((prev) => ({ ...prev, options: prev.options.map((o, idx) => (idx === i ? { ...o, color: v } : o)) }))
                    }
                  >
                    <SelectTrigger className="w-14 px-2">
                      <span className="size-3.5 rounded-full" style={{ backgroundColor: COLOR_SWATCH[option.color] ?? '#6b7280' }} />
                    </SelectTrigger>
                    <SelectContent>
                      {OPTION_COLORS.map((color) => (
                        <SelectItem key={color} value={color}>
                          <span className="flex items-center gap-2">
                            <span className="size-3 rounded-full" style={{ backgroundColor: COLOR_SWATCH[color] }} />
                            {color}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={option.label}
                    placeholder={`Option ${i + 1}`}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        options: prev.options.map((o, idx) =>
                          idx === i ? { ...o, label: e.target.value, value: prev.showAdvancedOptions ? o.value : slugifyValue(e.target.value) } : o,
                        ),
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant={isDefault ? 'secondary' : 'ghost'}
                    size="icon-sm"
                    title={isDefault ? 'Default option' : 'Set as default'}
                    onClick={() => toggleDefault(option.value)}
                  >
                    <Star className={isDefault ? 'size-4 fill-current' : 'size-4'} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setState((prev) => ({ ...prev, options: prev.options.filter((_, idx) => idx !== i) }))}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                {state.showAdvancedOptions && (
                  <Input
                    className="ml-6 h-7 text-xs"
                    value={option.value}
                    placeholder="API_VALUE"
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        options: prev.options.map((o, idx) => (idx === i ? { ...o, value: e.target.value } : o)),
                      }))
                    }
                  />
                )}
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setState((prev) => {
                const n = prev.options.length;
                return {
                  ...prev,
                  options: [...prev.options, { label: `Option ${n + 1}`, value: `OPTION_${n + 1}`, color: OPTION_COLORS[n % OPTION_COLORS.length] ?? 'gray' }],
                };
              })
            }
          >
            <Plus className="size-4" /> Add option
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

/** Create-or-edit field dialog. In edit mode the field type is fixed and shown read-only. */
export function FieldFormDialog({
  objectId,
  mode,
  field,
  open,
  onOpenChange,
}: {
  objectId: string;
  mode: 'create' | 'edit';
  field?: DataModelField;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<string | null>(mode === 'edit' ? (field?.type ?? null) : null);
  const [icon, setIcon] = useState(field?.icon && field.icon !== 'Circle' ? field.icon : 'Circle');
  const [label, setLabel] = useState(field?.label ?? '');
  const [description, setDescription] = useState(field?.description ?? '');
  const [isNullable, setIsNullable] = useState(field?.isNullable ?? true);
  const [isUnique, setIsUnique] = useState(field?.isUnique ?? false);
  const [config, setConfig] = useState<FieldConfigState>(() => initialConfigState(field));
  const [error, setError] = useState<string | null>(null);

  // Re-seed from the field whenever the dialog (re)opens in edit mode.
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && field) {
      setType(field.type);
      setIcon(field.icon && field.icon !== 'Circle' ? field.icon : 'Circle');
      setLabel(field.label);
      setDescription(field.description ?? '');
      setIsNullable(field.isNullable);
      setIsUnique(field.isUnique);
      setConfig(initialConfigState(field));
    } else if (mode === 'create') {
      setType(null);
      setIcon('Circle');
      setLabel('');
      setDescription('');
      setIsNullable(true);
      setIsUnique(false);
      setConfig(initialConfigState());
    }
    setError(null);
  }, [open, mode, field]);

  const save = useMutation({
    mutationFn: () => {
      const { settings, defaultValue } = buildFieldPayload(type!, config);
      if (mode === 'edit' && field) {
        return dataModelApi.updateField(objectId, field.id, {
          label,
          description: description || undefined,
          icon: icon === 'Circle' ? undefined : icon,
          settings,
          defaultValue,
        });
      }
      const input: CreateFieldRequest = {
        label,
        description: description || undefined,
        icon: icon === 'Circle' ? undefined : icon,
        type: type as CreateFieldRequest['type'],
        isNullable,
        isUnique,
        settings,
        defaultValue,
      };
      return dataModelApi.createField(objectId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['data-model-object', objectId] });
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const TypeIcon = type ? (FIELD_TYPE_ICON[type] ?? Circle) : Circle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {mode === 'create' && !type ? (
          <>
            <DialogHeader>
              <DialogTitle>Select a field type</DialogTitle>
              <DialogDescription>What kind of data will this field hold?</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {FIELD_TYPE_GROUPS.map((group) => (
                <div key={group.title} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{group.title}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.types.map(({ type: t, label: l }) => {
                      const Icon = FIELD_TYPE_ICON[t] ?? CaseSensitive;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className="flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm hover:bg-muted/50"
                        >
                          <Icon className="size-4 text-muted-foreground" />
                          {l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{mode === 'edit' ? 'Edit field' : 'Configure field'}</DialogTitle>
              <DialogDescription className="flex items-center gap-1.5">
                <TypeIcon className="size-3.5" /> {type ? FIELD_TYPE_LABEL[type] : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <div>
                  <IconPicker value={icon} options={ROLE_ICON_OPTIONS} onChange={setIcon} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Label</Label>
                <Input value={label} autoFocus onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              {type && <FieldTypeSettings type={type} state={config} setState={setConfig} />}

              {mode === 'create' && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!isNullable} onCheckedChange={(c) => setIsNullable(!(c === true))} />
                    Required
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={isUnique} onCheckedChange={(c) => setIsUnique(c === true)} />
                    Unique
                  </label>
                </>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              {mode === 'create' && (
                <Button type="button" variant="outline" onClick={() => setType(null)}>
                  Back
                </Button>
              )}
              <Button type="button" disabled={!label.trim() || save.isPending} onClick={() => { setError(null); save.mutate(); }}>
                {mode === 'edit' ? 'Save' : 'Create field'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
