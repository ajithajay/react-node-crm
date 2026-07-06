import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { meApi } from '@/lib/api-client';
import { NAV_ITEMS } from '../nav-items';

export function HomePage() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: meApi.get });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome{me ? `, ${me.firstName}` : ''}</h1>
        <p className="text-muted-foreground">Here's your workspace at a glance.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {NAV_ITEMS.map((item) => (
          <Link key={item.path} to={item.path}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <item.icon className="size-4" />
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">View {item.label.toLowerCase()}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
