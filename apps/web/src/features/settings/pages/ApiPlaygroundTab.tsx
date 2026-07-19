import { Link } from 'react-router';
import { ArrowUpRight, Globe } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Launcher for the interactive REST reference. Only the external v1 API is shown here — Core and
 * Metadata (session-only, used internally by this app) can never be called with an API key, so
 * showing them alongside v1 would mislead an integrator testing their key. Opens the full-screen
 * Scalar playground (RestPlaygroundPage); Scalar renders broken when squeezed into this narrow
 * settings panel, so it gets its own full-viewport route.
 */
export function ApiPlaygroundTab() {
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Explore and test the external REST API interactively. Requests are authenticated with one
        of your API keys.
      </p>
      <Link to="/settings/playground/rest/v1" className="block max-w-sm">
        <Card className="transition-colors hover:border-primary/50 hover:bg-muted/40">
          <CardHeader>
            <div className="mb-1 flex items-center justify-between">
              <Globe className="size-5 text-muted-foreground" />
              <ArrowUpRight className="size-4 text-muted-foreground" />
            </div>
            <CardTitle>External API (v1)</CardTitle>
            <CardDescription>
              Workspace, members, invitations, webhooks, data model and records — for external
              integrations, requires an API key.
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>
    </div>
  );
}
