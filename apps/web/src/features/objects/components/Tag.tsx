import { tagColor } from '../lib/table-tokens';

/** Colored pill for SELECT/MULTI_SELECT values (pastel bg, saturated text, 20px tall). */
export function Tag({ label, color }: { label: string; color?: string }) {
  const { bg, text } = tagColor(color);
  return (
    <span
      className="inline-flex h-5 max-w-full items-center truncate rounded-sm px-2 text-xs font-medium"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}
