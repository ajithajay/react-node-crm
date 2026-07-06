import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import type { WorkspaceSummary } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authApi, ApiError } from '@/lib/api-client';
import { AuthCard } from '../components/AuthCard';

export function SelectWorkspacePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { token?: string; workspaces?: WorkspaceSummary[] } | null;
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function select(workspaceId: string): Promise<void> {
    if (!state?.token) return;
    setError(null);
    setPendingId(workspaceId);
    try {
      const result = await authApi.selectWorkspace(state.token, workspaceId);
      if (result.requiresTwoFactor) {
        navigate('/2fa', { state: { challengeToken: result.challengeToken } });
        return;
      }
      window.location.href = result.redirectUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setPendingId(null);
    }
  }

  if (!state?.token || !state.workspaces) {
    return (
      <AuthCard title="Session expired" description="Please log in again to continue.">
        <Link to="/login" className="text-sm underline">
          Back to login
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Pick a workspace" description="You belong to more than one workspace.">
      <div className="space-y-2">
        {state.workspaces.map((workspace) => (
          <Button
            key={workspace.id}
            variant="outline"
            className="w-full justify-start"
            disabled={pendingId !== null}
            onClick={() => select(workspace.id)}
          >
            {workspace.name} <span className="ml-1 text-slate-400">({workspace.subdomain})</span>
          </Button>
        ))}
      </div>
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Link
        to="/create-workspace"
        state={{ token: state.token }}
        className="mt-4 block text-center text-sm underline"
      >
        Create a new workspace instead
      </Link>
    </AuthCard>
  );
}
