import type { DashboardWidgetConfiguration } from '@/lib/api-client';
import { useChartData } from '../../lib/use-chart-data';
import { formatChartNumber } from '../../lib/widget-defaults';
import { WidgetEmptyState, WidgetLoading } from '../WidgetStates';

export function AggregateChartWidget({
  objectMetadataId,
  configuration,
}: {
  objectMetadataId: string | null;
  configuration: DashboardWidgetConfiguration;
}) {
  const { data, isLoading, isError } = useChartData(objectMetadataId, configuration);

  if (!objectMetadataId) return <WidgetEmptyState message="Choose a data source to get started." />;
  if (isLoading) return <WidgetLoading />;
  if (isError || !data) return <WidgetEmptyState message="Couldn't load this chart." />;

  const value = data.data[0]?.value ?? 0;
  const formatted = formatChartNumber(value, configuration.numberFormat);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
      <div className="text-3xl font-semibold tabular-nums">
        {configuration.prefix ?? ''}
        {formatted}
        {configuration.suffix ?? ''}
      </div>
    </div>
  );
}
