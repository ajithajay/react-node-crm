import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthSessionProvider } from '@/lib/auth-session';
import { applyColorScheme, getCachedColorScheme } from '@/lib/theme';
import App from '@/App';
import '@/index.css';

// Apply the last-known theme synchronously, before the first paint, to avoid a flash.
applyColorScheme(getCachedColorScheme());

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

const queryClient = new QueryClient();

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthSessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
