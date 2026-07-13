/** Validated categorical palette (dataviz skill `references/palette.md`) — fixed hue order, never
 * cycled per-render. Worst adjacent CVD ΔE 24.2 light / 10.3 dark; three light-mode slots (aqua,
 * yellow, magenta) sit below 3:1 contrast, so charts using this palette must keep direct labels or a
 * legend visible rather than relying on color alone. */
export const CHART_SERIES_LIGHT = [
  '#2a78d6', // blue
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
  '#e87ba4', // magenta
  '#eb6834', // orange
] as const;

export const CHART_SERIES_DARK = [
  '#3987e5',
  '#199e70',
  '#c98500',
  '#008300',
  '#9085e9',
  '#e66767',
  '#d55181',
  '#d95926',
] as const;

export function chartSeriesColor(index: number, isDark: boolean): string {
  const palette = isDark ? CHART_SERIES_DARK : CHART_SERIES_LIGHT;
  return palette[index % palette.length]!;
}

export function chartTextColor(isDark: boolean): string {
  return isDark ? '#c3c2b7' : '#52514e';
}

export function chartGridColor(isDark: boolean): string {
  return isDark ? '#3a3a38' : '#e5e4df';
}
