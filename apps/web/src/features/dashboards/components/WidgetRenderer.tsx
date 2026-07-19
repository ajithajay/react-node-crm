import type { DashboardWidget } from '@/lib/api-client';
import type { RichTextValue } from '@/features/objects/components/RichTextEditor';
import { GraphWidget } from './charts/GraphWidget';
import { IframeWidgetView } from './IframeWidgetView';
import { RecordTableWidgetView } from './RecordTableWidgetView';
import { RichTextWidgetView } from './RichTextWidgetView';
import { WidgetEmptyState } from './WidgetStates';

/** The top-level widget-type switch. */
export function WidgetRenderer({
  widget,
  editMode,
  onRichTextChange,
}: {
  widget: DashboardWidget;
  editMode: boolean;
  onRichTextChange: (value: RichTextValue) => void;
}) {
  switch (widget.type) {
    case 'GRAPH':
      return <GraphWidget objectMetadataId={widget.objectMetadataId} configuration={widget.configuration} />;
    case 'IFRAME':
      return <IframeWidgetView configuration={widget.configuration} editMode={editMode} />;
    case 'RECORD_TABLE':
      return <RecordTableWidgetView objectMetadataId={widget.objectMetadataId} configuration={widget.configuration} />;
    case 'STANDALONE_RICH_TEXT':
      return <RichTextWidgetView configuration={widget.configuration} editable={editMode} onChange={onRichTextChange} />;
    default:
      return <WidgetEmptyState message="Unsupported widget type." />;
  }
}
