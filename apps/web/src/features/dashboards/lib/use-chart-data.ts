import { useQuery } from '@tanstack/react-query';
import { dashboardApi, type DashboardWidgetConfiguration } from '@/lib/api-client';

/** Fetches a GRAPH widget's computed chart data. Requires both an object and a group-by/aggregate
 * choice to be selected — an unconfigured freshly-added widget shows a "configure this widget"
 * empty state instead of querying. */
export function useChartData(objectMetadataId: string | null, configuration: DashboardWidgetConfiguration) {
  const isAggregateOnly = configuration.configurationType === 'AGGREGATE_CHART';
  const isConfigured = !!objectMetadataId && (isAggregateOnly || !!configuration.groupByFieldMetadataId);

  return useQuery({
    queryKey: ['dashboard-chart-data', objectMetadataId, configuration],
    queryFn: () => dashboardApi.chartData({ objectMetadataId: objectMetadataId!, configuration }),
    enabled: isConfigured,
  });
}
