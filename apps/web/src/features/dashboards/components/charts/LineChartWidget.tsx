import { CartesianGrid, Label, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardWidgetConfiguration } from '@/lib/api-client';
import { useChartData } from '../../lib/use-chart-data';
import { pivotBySecondary } from '../../lib/chart-pivot';
import { chartGridColor, chartSeriesColor, chartTextColor } from '../../lib/chart-colors';
import { useIsDarkMode } from '../../lib/use-is-dark-mode';
import { WidgetEmptyState, WidgetLoading } from '../WidgetStates';

export function LineChartWidget({
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
  const colorSeed = configuration.colorSeed ?? 0;
  const { rows, seriesKeys } = pivotBySecondary(data.data);
  // Ascending by key so a date-granularity group-by reads left-to-right chronologically.
  const sorted = [...rows].sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const isMultiSeries = seriesKeys.length > 1 || seriesKeys[0] !== 'value';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={sorted} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="key" tick={{ fill: textColor, fontSize: 11 }} />
        <YAxis
          tick={{ fill: textColor, fontSize: 11 }}
          domain={[configuration.rangeMin ?? 'auto', configuration.rangeMax ?? 'auto']}
        >
          {configuration.axisName && <Label value={configuration.axisName} angle={-90} position="insideLeft" fill={textColor} />}
        </YAxis>
        <Tooltip contentStyle={{ fontSize: 12 }} />
        {isMultiSeries && <Legend wrapperStyle={{ fontSize: 12, color: textColor }} />}
        {seriesKeys.map((seriesKey, si) => (
          <Line
            key={seriesKey}
            type="monotone"
            dataKey={seriesKey}
            name={seriesKey}
            stroke={chartSeriesColor(colorSeed + si, isDark)}
            strokeWidth={2}
            dot={{ r: 4, fill: chartSeriesColor(colorSeed + si, isDark) }}
          >
            {configuration.displayDataLabel && <LabelList dataKey={seriesKey} position="top" fontSize={11} fill={textColor} />}
          </Line>
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
