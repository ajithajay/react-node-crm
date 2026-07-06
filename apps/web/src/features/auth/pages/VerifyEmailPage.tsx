import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { authApi, ApiError } from '@/lib/api-client';
import { AuthCard } from '../components/AuthCard';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing verification token');
      return;
    }
    authApi
      .verifyEmail(token)
      .then((result) => {
        navigate('/create-workspace', { state: { token: result.workspaceAgnosticToken }, replace: true });
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Verification failed');
      });
  }, [token, navigate]);

  if (!error) {
    return <AuthCard title="Verifying your email">Please wait…</AuthCard>;
  }

  return (
    <AuthCard title="Verification failed" description={error}>
      <Link to="/login" className="text-sm underline">
        Back to login
      </Link>
    </AuthCard>
  );
}
