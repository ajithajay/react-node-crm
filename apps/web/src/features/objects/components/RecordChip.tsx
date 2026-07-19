const AVATAR_COLORS = ['#4159C0', '#308052', '#B5641D', '#7C3AAF', '#C0333D', '#1F7FAE', '#C23B87', '#5D8A1A'];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

/** Avatar-circle + name chip used for the label-identifier column and resolved relations. */
export function RecordChip({ name }: { name: string }) {
  const label = name.trim() || '—';
  const initial = label.charAt(0).toUpperCase();
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white"
        style={{ backgroundColor: colorForName(label) }}
      >
        {initial}
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}
