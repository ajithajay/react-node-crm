import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, Mail, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiError, connectedAccountApi } from '@/lib/api-client';

interface ProviderOption {
  provider: 'GOOGLE' | 'MICROSOFT' | 'IMAP_SMTP_CALDAV';
  label: string;
  description: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

const PROVIDERS: ProviderOption[] = [
  {
    provider: 'GOOGLE',
    label: 'Continue with Google',
    description: 'Gmail & Google Calendar via secure OAuth.',
    icon: <Mail className="size-5" />,
  },
  {
    provider: 'IMAP_SMTP_CALDAV',
    label: 'IMAP / SMTP / CalDAV',
    description: 'Any other email & calendar provider.',
    icon: <Server className="size-5" />,
  },
  {
    provider: 'MICROSOFT',
    label: 'Continue with Microsoft',
    description: 'Coming soon.',
    icon: <Mail className="size-5" />,
    disabled: true,
  },
];

export function NewAccountPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function connect(provider: ProviderOption['provider']) {
    setError(null);
    if (provider === 'IMAP_SMTP_CALDAV') {
      navigate('/settings/accounts/new/imap');
      return;
    }
    if (provider === 'GOOGLE') {
      try {
        const { url } = await connectedAccountApi.googleInit();
        window.location.assign(url);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not start Google connection');
      }
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/settings/accounts')} className="mb-2 -ml-2">
          <ChevronLeft className="size-4" /> Accounts
        </Button>
        <h1 className="text-lg font-medium">Add account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose how you want to connect your mailbox and calendar.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {PROVIDERS.map((option) => (
          <Card key={option.provider} className={option.disabled ? 'opacity-60' : ''}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="text-muted-foreground">{option.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
              <Button variant="outline" disabled={option.disabled} onClick={() => connect(option.provider)}>
                Connect
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
