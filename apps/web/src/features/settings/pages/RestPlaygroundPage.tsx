import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { getAccessToken } from '@/lib/auth-session';
import { getApiBaseUrl } from '@/lib/host';

const SCHEMAS = [
  { key: 'core', label: 'Core' },
  { key: 'metadata', label: 'Metadata' },
  { key: 'v1', label: 'External (v1)' },
] as const;

/**
 * Full-screen REST playground. The interactive Scalar reference is rendered inside an iframe
 * (`/playground.html`, a separate Vite entry) so it gets a pristine document with only its own CSS —
 * the app's global Tailwind preflight otherwise leaks into Scalar's subtree and breaks its layout.
 * The token is handed to the iframe over postMessage once it signals ready (same-origin), so it
 * never appears in the iframe URL. Core/Metadata use the session's access token automatically; v1
 * is API-key-only (the guard rejects session tokens), and keys aren't retrievable after creation,
 * so the user pastes one in here instead.
 */
export function RestPlaygroundPage() {
  const { schema } = useParams<{ schema: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [apiKey, setApiKey] = useState('');
  const isValid = schema === 'core' || schema === 'metadata' || schema === 'v1';
  const sessionToken = getAccessToken() ?? '';
  const testToken = schema === 'v1' ? apiKey : sessionToken;

  useEffect(() => {
    if (!isValid) return;
    function onMessage(event: MessageEvent): void {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string })?.type === 'playground-ready') {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'playground-config', schema, sessionToken, testToken, apiBaseUrl: getApiBaseUrl() },
          window.location.origin,
        );
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [schema, isValid, sessionToken, testToken]);

  if (!isValid) return <Navigate to="/settings/playground/rest/core" replace />;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <Link
          to="/settings/api"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> API & Webhooks
        </Link>
        <div className="ml-2 flex items-center gap-1">
          {SCHEMAS.map((s) => (
            <Link
              key={s.key}
              to={`/settings/playground/rest/${s.key}`}
              className={cn(
                'rounded-md px-3 py-1 text-sm hover:bg-muted',
                s.key === schema && 'bg-muted font-medium',
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>
        {schema === 'v1' && (
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste an API key to test with…"
            className="ml-2 h-8 max-w-xs text-sm"
          />
        )}
      </header>
      <iframe
        ref={iframeRef}
        key={schema}
        title="REST API playground"
        src={`/playground.html?schema=${schema}`}
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>
  );
}
