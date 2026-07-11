import { Navigate, Outlet, Route, Routes, useParams } from 'react-router';
import { useAuthSession } from '@/lib/auth-session';
import { ShellLayout } from '@/features/shell/ShellLayout';
import { HomePage } from '@/features/shell/pages/HomePage';
import { ComingSoonPage } from '@/features/shell/pages/ComingSoonPage';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { LayoutPage } from '@/features/settings/pages/LayoutPage';
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
import { ObjectRecordsPage } from '@/features/objects/pages/ObjectRecordsPage';
import { LoginPage } from './pages/LoginPage';
import { ExchangePage } from './pages/ExchangePage';
import { TwoFactorChallengePage } from './pages/TwoFactorChallengePage';

/** Generic entry for any object not hardcoded above — reached via the sidebar's dynamic Custom Objects group. */
function CustomObjectRoute() {
  const { objectNamePlural } = useParams<{ objectNamePlural: string }>();
  return <ObjectRecordsPage objectNamePlural={objectNamePlural!} />;
}

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
          <Route path="/companies" element={<ObjectRecordsPage objectNamePlural="companies" />} />
          <Route path="/people" element={<ObjectRecordsPage objectNamePlural="people" />} />
          <Route path="/opportunities" element={<ObjectRecordsPage objectNamePlural="opportunities" />} />
          <Route path="/tasks" element={<ObjectRecordsPage objectNamePlural="tasks" />} />
          <Route path="/notes" element={<ObjectRecordsPage objectNamePlural="notes" />} />
          <Route path="/objects/:objectNamePlural" element={<CustomObjectRoute />} />
          <Route path="/dashboards" element={<ComingSoonPage title="Dashboards" phase="Phase 7" />} />
          <Route path="/workflows" element={<ComingSoonPage title="Workflows" phase="Phase 8" />} />
          <Route path="/workflows/runs" element={<ComingSoonPage title="Workflow Runs" phase="Phase 8" />} />
          <Route path="/workflows/versions" element={<ComingSoonPage title="Workflow Versions" phase="Phase 8" />} />

          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="/settings/profile" replace />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="experience" element={<ExperiencePage />} />
            <Route path="general" element={<GeneralPage />} />
            <Route path="layout" element={<LayoutPage />} />
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
