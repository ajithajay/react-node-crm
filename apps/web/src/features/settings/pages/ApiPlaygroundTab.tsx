import { Link } from 'react-router';
import { ArrowUpRight, Boxes, Database } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Launcher for the interactive REST reference — matches Twenty's Core / Metadata launch options.
 * Each card opens the full-screen Scalar playground (RestPlaygroundPage); Scalar renders broken
 * when squeezed into this narrow settings panel, so it gets its own full-viewport route.
 */
const SCHEMAS = [
  {
    key: 'core',
    label: 'Core API',
    description: 'Identity, workspace, members, roles, API keys and webhooks.',
    icon: Boxes,
  },
  {
    key: 'metadata',
    label: 'Metadata API',
    description: 'Data-model management — objects, fields, relations and indexes.',
    icon: Database,
  },
] as const;

export function ApiPlaygroundTab() {
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Explore and test the REST API interactively. Requests run as your current signed-in session.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SCHEMAS.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.key} to={`/settings/playground/rest/${s.key}`}>
              <Card className="transition-colors hover:border-primary/50 hover:bg-muted/40">
                <CardHeader>
                  <div className="mb-1 flex items-center justify-between">
                    <Icon className="size-5 text-muted-foreground" />
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </div>
                  <CardTitle>{s.label}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
