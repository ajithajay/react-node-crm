import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiReferenceReact } from '@scalar/api-reference-react';
// Explicit CSS import: the wrapper's own `import './style.css'` side-effect doesn't survive Vite's
// dep pre-bundling into this iframe document, so pull Scalar's stylesheet in directly.
import '@scalar/api-reference-react/style.css';

/**
 * Standalone Scalar playground, loaded in an iframe by RestPlaygroundPage. Deliberately a separate
 * Vite entry that imports NONE of the app's Tailwind CSS — Scalar ships its own full Tailwind v4
 * build, and two Tailwind preflights in one document collide (the app's global element resets leak
 * into Scalar's zero-specificity `:where(.scalar-app)` resets and break its layout). An iframe gives
 * Scalar a pristine document so it renders exactly as intended. The access token + API base URL are
 * handed in over postMessage (same-origin) rather than the URL, so the token never lands in history.
 */
interface PlaygroundConfig {
  schema: string;
  token: string;
  apiBaseUrl: string;
}

function Playground() {
  const [config, setConfig] = useState<PlaygroundConfig | null>(null);
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent): void {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string } & Partial<PlaygroundConfig>;
      if (data?.type === 'playground-config' && data.schema && data.apiBaseUrl) {
        setConfig({ schema: data.schema, token: data.token ?? '', apiBaseUrl: data.apiBaseUrl });
      }
    }
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: 'playground-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!config) return;
    void fetch(`${config.apiBaseUrl}/open-api/${config.schema}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Spec fetch failed (${res.status})`))))
      .then((json) => setSpec(json as Record<string, unknown>))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load spec'));
  }, [config]);

  if (error) return <div style={{ padding: 16, fontFamily: 'sans-serif' }}>{error}</div>;
  if (!config || !spec) return <div style={{ padding: 16, fontFamily: 'sans-serif' }}>Loading…</div>;

  return (
    <ApiReferenceReact
      configuration={{
        content: spec,
        baseServerURL: config.apiBaseUrl,
        hideClientButton: true,
        authentication: {
          preferredSecurityScheme: 'bearerAuth',
          securitySchemes: { bearerAuth: { token: config.token } },
        },
      }}
    />
  );
}

createRoot(document.getElementById('scalar-root')!).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
);
