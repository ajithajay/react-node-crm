import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getAccessToken } from '@/lib/auth-session';
import { getApiBaseUrl } from '@/lib/host';

/**
 * Full-screen REST playground for the external v1 API. The interactive Scalar reference is
 * rendered inside an iframe (`/playground.html`, a separate Vite entry) so it gets a pristine
 * document with only its own CSS — the app's global Tailwind preflight otherwise leaks into
 * Scalar's subtree and breaks its layout. Tokens are handed to the iframe over postMessage once
 * it signals ready (same-origin), so they never appear in the iframe URL. `sessionToken` fetches
 * the OpenAPI document itself (session-gated regardless of schema); `testToken` is what Scalar's
 * try-it-out sends when calling `/api/v1` — an API key, since keys aren't retrievable after
 * creation and the guard rejects session tokens, so the user pastes one in here.
 */
export function RestPlaygroundPage() {
  const { schema } = useParams<{ schema: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [apiKey, setApiKey] = useState('');
  const sessionToken = getAccessToken() ?? '';

  useEffect(() => {
    if (schema !== 'v1') return;
    function onMessage(event: MessageEvent): void {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string })?.type === 'playground-ready') {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'playground-config', schema: 'v1', sessionToken, testToken: apiKey, apiBaseUrl: getApiBaseUrl() },
          window.location.origin,
        );
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [schema, sessionToken, apiKey]);

  if (schema !== 'v1') return <Navigate to="/settings/playground/rest/v1" replace />;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <Link
          to="/settings/api"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> API & Webhooks
        </Link>
        <span className="ml-2 text-sm font-medium">External API (v1)</span>
        <Input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste an API key to test with…"
          className="ml-2 h-8 max-w-xs text-sm"
        />
      </header>
      <iframe
        ref={iframeRef}
        title="REST API playground"
        src="/playground.html?schema=v1"
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>
  );
}
