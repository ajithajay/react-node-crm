import { Navigate, Outlet, Route, Routes } from 'react-router';
import { useAuthSession } from '@/lib/auth-session';
import { ShellLayout } from '@/features/shell/ShellLayout';
import { HomePage } from '@/features/shell/pages/HomePage';
import { ComingSoonPage } from '@/features/shell/pages/ComingSoonPage';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { SettingsPlaceholderPage } from '@/features/settings/pages/SettingsPlaceholderPage';
import { MembersPage } from '@/features/settings/pages/MembersPage';
import { ProfilePage } from '@/features/settings/pages/ProfilePage';
import { ExperiencePage } from '@/features/settings/pages/ExperiencePage';
import { GeneralPage } from '@/features/settings/pages/GeneralPage';
import { RoleDetailPage } from '@/features/settings/pages/RoleDetailPage';
import { RoleAddObjectPermissionPage } from '@/features/settings/pages/RoleAddObjectPermissionPage';
import { RoleObjectPermissionPage } from '@/features/settings/pages/RoleObjectPermissionPage';
import { DataModelListPage } from '@/features/settings/pages/data-model/DataModelListPage';
import { ObjectDetailPage } from '@/features/settings/pages/data-model/ObjectDetailPage';
import { ApiSettingsPage } from '@/features/settings/pages/ApiSettingsPage';
import { RestPlaygroundPage } from '@/features/settings/pages/RestPlaygroundPage';
import { LoginPage } from './pages/LoginPage';
import { ExchangePage } from './pages/ExchangePage';
import { TwoFactorChallengePage } from './pages/TwoFactorChallengePage';

function ProtectedLayout() {
  const { status } = useAuthSession();
  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Routes mounted on a workspace subdomain (`<sub>.<base>`). */
export function WorkspaceHostRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/exchange" element={<ExchangePage />} />
      <Route path="/2fa" element={<TwoFactorChallengePage />} />

      <Route element={<ProtectedLayout />}>
        {/* Full-screen — mounted outside ShellLayout/SettingsLayout so Scalar owns the viewport. */}
        <Route path="/settings/playground/rest/:schema" element={<RestPlaygroundPage />} />

        <Route element={<ShellLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/companies" element={<ComingSoonPage title="Companies" phase="Phase 6" />} />
          <Route path="/people" element={<ComingSoonPage title="People" phase="Phase 6" />} />
          <Route path="/opportunities" element={<ComingSoonPage title="Opportunities" phase="Phase 6" />} />
          <Route path="/tasks" element={<ComingSoonPage title="Tasks" phase="Phase 6" />} />
          <Route path="/notes" element={<ComingSoonPage title="Notes" phase="Phase 6" />} />
          <Route path="/dashboards" element={<ComingSoonPage title="Dashboards" phase="Phase 7" />} />
          <Route path="/workflows" element={<ComingSoonPage title="Workflows" phase="Phase 8" />} />
          <Route path="/workflows/runs" element={<ComingSoonPage title="Workflow Runs" phase="Phase 8" />} />
          <Route path="/workflows/versions" element={<ComingSoonPage title="Workflow Versions" phase="Phase 8" />} />

          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="/settings/profile" replace />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="experience" element={<ExperiencePage />} />
            <Route path="general" element={<GeneralPage />} />
            <Route path="layout" element={<SettingsPlaceholderPage title="Layout" phase="Phase 5g" />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="roles" element={<Navigate to="/settings/members" replace />} />
            <Route path="roles/:id/add-object-permission" element={<RoleAddObjectPermissionPage />} />
            <Route path="roles/:id/object/:objectMetadataId" element={<RoleObjectPermissionPage />} />
            <Route path="roles/:id" element={<RoleDetailPage />} />
            <Route path="api" element={<ApiSettingsPage />} />
            <Route path="objects" element={<DataModelListPage />} />
            <Route path="objects/:id" element={<ObjectDetailPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
