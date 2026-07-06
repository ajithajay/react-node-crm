import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { authApi, ApiError } from '@/lib/api-client';
import { useAuthSession } from '@/lib/auth-session';
import { AuthCard } from '../components/AuthCard';

export function ExchangePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { setSession } = useAuthSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing login token');
      return;
    }
    authApi
      .exchangeLoginToken(token)
      .then((result) => {
        setSession(result.accessToken, result.workspaceId);
        navigate('/', { replace: true });
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Login failed');
      });
  }, [token, navigate, setSession]);

  if (!error) {
    return <AuthCard title="Signing you in">Please wait…</AuthCard>;
  }

  return (
    <AuthCard title="Sign-in failed" description={error}>
      <Link to="/login" className="text-sm underline">
        Back to login
      </Link>
    </AuthCard>
  );
}
