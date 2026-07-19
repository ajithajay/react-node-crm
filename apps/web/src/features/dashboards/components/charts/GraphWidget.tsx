import type { DashboardWidgetConfiguration } from '@/lib/api-client';
import { AggregateChartWidget } from './AggregateChartWidget';
import { PieChartWidget } from './PieChartWidget';
import { BarChartWidget } from './BarChartWidget';
import { LineChartWidget } from './LineChartWidget';
import { WidgetEmptyState } from '../WidgetStates';

/** A GRAPH widget's second-level type switch — dispatches on `configuration.configurationType`
 * (the widget's own `type` is just GRAPH; the chart sub-type lives in its config). */
export function GraphWidget({
  objectMetadataId,
  configuration,
}: {
  objectMetadataId: string | null;
  configuration: DashboardWidgetConfiguration;
}) {
  switch (configuration.configurationType) {
    case 'AGGREGATE_CHART':
      return <AggregateChartWidget objectMetadataId={objectMetadataId} configuration={configuration} />;
    case 'PIE_CHART':
      return <PieChartWidget objectMetadataId={objectMetadataId} configuration={configuration} />;
    case 'BAR_CHART':
      return <BarChartWidget objectMetadataId={objectMetadataId} configuration={configuration} />;
    case 'LINE_CHART':
      return <LineChartWidget objectMetadataId={objectMetadataId} configuration={configuration} />;
    default:
      return <WidgetEmptyState message="Pick a chart type to get started." />;
  }
}
