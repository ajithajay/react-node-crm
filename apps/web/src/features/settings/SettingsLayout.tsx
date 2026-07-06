import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SETTINGS_NAV } from './settings-nav';

export function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex max-w-5xl gap-8">
      <aside className="w-56 shrink-0 space-y-6">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate('/')}>
          <ArrowLeft /> Back
        </Button>
        {SETTINGS_NAV.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">{group.label}</p>
            <nav className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-sm hover:bg-muted',
                    location.pathname === item.path && 'bg-muted font-medium',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </aside>
      <div className="min-w-0 flex-1 py-1">
        <Outlet />
      </div>
    </div>
  );
}
