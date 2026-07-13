import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, type PieLabelRenderProps } from 'recharts';
import type { DashboardWidgetConfiguration } from '@/lib/api-client';
import { useChartData } from '../../lib/use-chart-data';
import { chartSeriesColor, chartTextColor } from '../../lib/chart-colors';
import { useIsDarkMode } from '../../lib/use-is-dark-mode';
import { WidgetEmptyState, WidgetLoading } from '../WidgetStates';

export function PieChartWidget({
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
  const colorSeed = configuration.colorSeed ?? 0;
  const showLegend = configuration.displayLegend ?? true;
  const showCenter = configuration.showCenterMetric ?? true;
  const total = data.data.reduce((sum, d) => sum + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data.data}
          dataKey="value"
          nameKey="key"
          cx="50%"
          cy="50%"
          innerRadius={showCenter ? '45%' : 0}
          outerRadius="70%"
          label={
            configuration.displayDataLabel
              ? (props: PieLabelRenderProps) => `${String(props.name ?? '')} ${Math.round((props.percent ?? 0) * 100)}%`
              : false
          }
        >
          {data.data.map((entry, i) => (
            <Cell key={entry.key} fill={chartSeriesColor(colorSeed + i, isDark)} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12 }} />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12, color: textColor }} />}
        {showCenter && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground">
            <tspan x="50%" dy="-0.3em" fontSize={22} fontWeight={600}>
              {total}
            </tspan>
            <tspan x="50%" dy="1.4em" fontSize={11} fill={textColor}>
              Total
            </tspan>
          </text>
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
