import type { DashboardWidgetConfiguration } from '@/lib/api-client';
import { RichTextEditor, type RichTextValue } from '@/features/objects/components/RichTextEditor';

export function RichTextWidgetView({
  configuration,
  editable,
  onChange,
}: {
  configuration: DashboardWidgetConfiguration;
  editable: boolean;
  onChange: (value: RichTextValue) => void;
}) {
  const value: RichTextValue = { blocknote: configuration.blocknote, markdown: configuration.markdown ?? null };
  return (
    <div className="h-full overflow-auto p-2">
      <RichTextEditor value={value} onChange={onChange} editable={editable} />
    </div>
  );
}
