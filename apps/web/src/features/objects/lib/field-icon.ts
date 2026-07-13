import type { LucideIcon } from 'lucide-react';
import { getIcon } from '@/lib/icons';
import type { DataModelField } from '@/lib/api-client';
import { FIELD_TYPE_ICON } from './table-tokens';

/** A field's own custom icon if set, else the type's default icon (Data Model settings' convention). */
export function fieldIcon(field: Pick<DataModelField, 'icon' | 'type'>): LucideIcon {
  if (field.icon && field.icon !== 'Circle') return getIcon(field.icon);
  return getIcon(FIELD_TYPE_ICON[field.type] ?? 'Circle');
}
