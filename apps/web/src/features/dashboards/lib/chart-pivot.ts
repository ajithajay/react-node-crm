import type { ChartDataPoint } from '@/lib/api-client';

export interface PivotedSeries {
  rows: Record<string, string | number>[];
  /** Data keys to render as series — `['value']` when there's no secondary group-by (single series). */
  seriesKeys: string[];
}

/** Pivots a flat `[{key, secondaryKey?, value}]` result into recharts-friendly rows — one row per
 * primary key, one column per distinct `secondaryKey` — for a 2D-grouped (multi-series) bar/line
 * chart. Falls back to a single `value` series when no widget has a secondary group-by configured. */
export function pivotBySecondary(data: ChartDataPoint[]): PivotedSeries {
  const hasSecondary = data.some((d) => d.secondaryKey !== undefined);
  if (!hasSecondary) {
    return { rows: data.map((d) => ({ key: d.key, value: d.value })), seriesKeys: ['value'] };
  }

  const seriesKeysSet = new Set<string>();
  const rowByKey = new Map<string, Record<string, string | number>>();
  for (const d of data) {
    const sKey = d.secondaryKey ?? '(none)';
    seriesKeysSet.add(sKey);
    const row = rowByKey.get(d.key) ?? { key: d.key };
    row[sKey] = d.value;
    rowByKey.set(d.key, row);
  }
  return { rows: [...rowByKey.values()], seriesKeys: [...seriesKeysSet] };
}
