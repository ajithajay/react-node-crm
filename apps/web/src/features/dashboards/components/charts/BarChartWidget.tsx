import { Bar, BarChart, CartesianGrid, Cell, Label, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardWidgetConfiguration } from '@/lib/api-client';
import { useChartData } from '../../lib/use-chart-data';
import { pivotBySecondary } from '../../lib/chart-pivot';
import { chartGridColor, chartSeriesColor, chartTextColor } from '../../lib/chart-colors';
import { useIsDarkMode } from '../../lib/use-is-dark-mode';
import { WidgetEmptyState, WidgetLoading } from '../WidgetStates';

export function BarChartWidget({
  objectMetadataId,
  configuration,
}: {
  objectMetadataId: string | null;
  configuration: DashboardWidgetConfiguration;
}) {
  const isDark = useIsDarkMode();
  const { data, isLoading, isError } = useChartData(objectMetadataId, configuration);

  if (!objectMetadataId || !configuration.groupByFieldMetadataId) {
    return <WidgetEmptyState message="Choose a data source and a group-by field to get started." />;
  }
  if (isLoading) return <WidgetLoading />;
  if (isError || !data) return <WidgetEmptyState message="Couldn't load this chart." />;
  if (data.data.length === 0) return <WidgetEmptyState message="No data yet." />;

  const textColor = chartTextColor(isDark);
  const gridColor = chartGridColor(isDark);
  const isHorizontal = configuration.layout === 'HORIZONTAL';
  const colorSeed = configuration.colorSeed ?? 0;
  const { rows, seriesKeys } = pivotBySecondary(data.data);
  const isMultiSeries = seriesKeys.length > 1 || seriesKeys[0] !== 'value';
  const valueAxisProps = { domain: [configuration.rangeMin ?? 'auto', configuration.rangeMax ?? 'auto'] as [number | string, number | string] };
  const axisNameLabel = configuration.axisName
    ? { value: configuration.axisName, position: isHorizontal ? ('insideBottom' as const) : ('insideLeft' as const), angle: isHorizontal ? 0 : -90 }
    : undefined;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout={isHorizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        {isHorizontal ? (
          <>
            <XAxis type="number" tick={{ fill: textColor, fontSize: 11 }} {...valueAxisProps}>
              {axisNameLabel && <Label {...axisNameLabel} fill={textColor} />}
            </XAxis>
            <YAxis type="category" dataKey="key" width={90} tick={{ fill: textColor, fontSize: 11 }} />
          </>
        ) : (
          <>
            <XAxis dataKey="key" tick={{ fill: textColor, fontSize: 11 }} />
            <YAxis tick={{ fill: textColor, fontSize: 11 }} {...valueAxisProps}>
              {axisNameLabel && <Label {...axisNameLabel} fill={textColor} />}
            </YAxis>
          </>
        )}
        <Tooltip contentStyle={{ fontSize: 12 }} />
        {isMultiSeries && <Legend wrapperStyle={{ fontSize: 12, color: textColor }} />}
        {seriesKeys.map((seriesKey, si) => (
          <Bar key={seriesKey} dataKey={seriesKey} name={seriesKey} radius={[4, 4, 0, 0]} fill={chartSeriesColor(colorSeed + si, isDark)}>
            {configuration.displayDataLabel && <LabelList dataKey={seriesKey} position={isHorizontal ? 'right' : 'top'} fontSize={11} fill={textColor} />}
            {!isMultiSeries &&
              rows.map((_, i) => <Cell key={i} fill={chartSeriesColor(colorSeed + i, isDark)} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
