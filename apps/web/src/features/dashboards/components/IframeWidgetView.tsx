import type { DashboardWidgetConfiguration } from '@/lib/api-client';
import { WidgetEmptyState } from './WidgetStates';

/** Only http(s) URLs render — guards against `javascript:`/`data:` etc. */
function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function IframeWidgetView({ configuration, editMode }: { configuration: DashboardWidgetConfiguration; editMode: boolean }) {
  const url = safeUrl(configuration.url);
  if (!url) return <WidgetEmptyState message="Set a URL to get started." />;

  return (
    <iframe
      src={url}
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
      style={editMode ? { pointerEvents: 'none' } : undefined}
      title="Embedded content"
    />
  );
}
