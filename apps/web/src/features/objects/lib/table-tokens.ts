import { FieldMetadataType } from '@saasly/shared';
import { OPTION_COLORS } from '@/features/settings/pages/data-model/field-config';

/**
 * Pastel background / saturated text pairs, following a tag component's visual language
 * (light pill background, darker saturated text of the same hue) — approximated per our existing
 * OPTION_COLORS palette, since our color vocabulary differs from any reference token names.
 */
export const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  blue: { bg: '#EEF1FD', text: '#4159C0' },
  green: { bg: '#E9F5EC', text: '#308052' },
  yellow: { bg: '#FBF6DA', text: '#9A7B0A' },
  orange: { bg: '#FCEEE3', text: '#B5641D' },
  purple: { bg: '#F4EEFC', text: '#7C3AAF' },
  red: { bg: '#FCEBEB', text: '#C0333D' },
  gray: { bg: '#F1F1F1', text: '#666666' },
  pink: { bg: '#FCEEF6', text: '#C23B87' },
  sky: { bg: '#E9F4FC', text: '#1F7FAE' },
  teal: { bg: '#E6F5F2', text: '#1B8371' },
  lime: { bg: '#F1F8E3', text: '#5D8A1A' },
  amber: { bg: '#FCF1DE', text: '#B0740D' },
};

export function tagColor(name: string | undefined): { bg: string; text: string } {
  return TAG_COLORS[name ?? ''] ?? TAG_COLORS[OPTION_COLORS[0]!]!;
}

/** Field-type icon fallback (lucide-react names), used for table column headers. */
export const FIELD_TYPE_ICON: Record<string, string> = {
  [FieldMetadataType.TEXT]: 'Type',
  [FieldMetadataType.NUMBER]: 'Hash',
  [FieldMetadataType.BOOLEAN]: 'ToggleLeft',
  [FieldMetadataType.DATE_TIME]: 'CalendarClock',
  [FieldMetadataType.DATE]: 'Calendar',
  [FieldMetadataType.SELECT]: 'ChevronDownCircle',
  [FieldMetadataType.MULTI_SELECT]: 'ListChecks',
  [FieldMetadataType.RATING]: 'Star',
  [FieldMetadataType.FILES]: 'Paperclip',
  [FieldMetadataType.CURRENCY]: 'DollarSign',
  [FieldMetadataType.EMAILS]: 'Mail',
  [FieldMetadataType.LINKS]: 'Link',
  [FieldMetadataType.PHONES]: 'Phone',
  [FieldMetadataType.FULL_NAME]: 'User',
  [FieldMetadataType.ADDRESS]: 'MapPin',
  [FieldMetadataType.RICH_TEXT]: 'FileText',
  [FieldMetadataType.ACTOR]: 'UserCog',
  [FieldMetadataType.RELATION]: 'ArrowRightLeft',
  [FieldMetadataType.MORPH_RELATION]: 'Shuffle',
  [FieldMetadataType.RAW_JSON]: 'Braces',
  [FieldMetadataType.ARRAY]: 'List',
  [FieldMetadataType.UUID]: 'Fingerprint',
};

/** 32px table row height and matching header/cell paddings. */
export const TABLE_ROW_HEIGHT = 32;
