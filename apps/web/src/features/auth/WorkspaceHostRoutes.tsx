import { Navigate, Outlet, Route, Routes, useParams } from 'react-router';
import { useAuthSession } from '@/lib/auth-session';
import { ShellLayout } from '@/features/shell/ShellLayout';
import { HomePage } from '@/features/shell/pages/HomePage';
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
import { DataModelVisualizePage } from '@/features/settings/pages/data-model/DataModelVisualizePage';
import { ObjectDetailPage } from '@/features/settings/pages/data-model/ObjectDetailPage';
import { ApiSettingsPage } from '@/features/settings/pages/ApiSettingsPage';
import { AccountsPage } from '@/features/settings/pages/accounts/AccountsPage';
import { NewAccountPage } from '@/features/settings/pages/accounts/NewAccountPage';
import { NewImapAccountPage } from '@/features/settings/pages/accounts/NewImapAccountPage';
import { EditImapAccountPage } from '@/features/settings/pages/accounts/EditImapAccountPage';
import { AccountDetailPage } from '@/features/settings/pages/accounts/AccountDetailPage';
import { RestPlaygroundPage } from '@/features/settings/pages/RestPlaygroundPage';
import { ObjectRecordsPage } from '@/features/objects/pages/ObjectRecordsPage';
import { RecordDetailPage } from '@/features/objects/pages/RecordDetailPage';
import { DashboardsListPage } from '@/features/dashboards/pages/DashboardsListPage';
import { DashboardPage } from '@/features/dashboards/pages/DashboardPage';
import { WorkflowsListPage } from '@/features/workflows/pages/WorkflowsListPage';
import { WorkflowRunsListPage } from '@/features/workflows/pages/WorkflowRunsListPage';
import { WorkflowVersionsListPage } from '@/features/workflows/pages/WorkflowVersionsListPage';
import { WorkflowBuilderPage } from '@/features/workflows/pages/WorkflowBuilderPage';
import { WorkflowRunPage } from '@/features/workflows/pages/WorkflowRunPage';
import { WorkflowFormPage } from '@/features/workflows/pages/WorkflowFormPage';
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
      {/* Public FORM step page — no auth (scoped by the ids in the URL). */}
      <Route path="/forms/:workspaceId/:runId/:stepId" element={<WorkflowFormPage />} />

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
          <Route path="/objects/:objectNamePlural/:recordId" element={<RecordDetailPage />} />
          <Route path="/dashboards" element={<DashboardsListPage />} />
          <Route path="/dashboards/:id" element={<DashboardPage />} />
          <Route path="/workflows" element={<WorkflowsListPage />} />
          <Route path="/workflows/runs" element={<WorkflowRunsListPage />} />
          <Route path="/workflows/runs/:runId" element={<WorkflowRunPage />} />
          <Route path="/workflows/:id" element={<WorkflowBuilderPage />} />
          <Route path="/workflows/:id/versions" element={<WorkflowVersionsListPage />} />

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
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="accounts/new" element={<NewAccountPage />} />
            <Route path="accounts/new/imap" element={<NewImapAccountPage />} />
            <Route path="accounts/:id" element={<AccountDetailPage />} />
            <Route path="accounts/:id/edit" element={<EditImapAccountPage />} />
            <Route path="objects" element={<DataModelListPage />} />
            <Route path="objects/visualize" element={<DataModelVisualizePage />} />
            <Route path="objects/:id" element={<ObjectDetailPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
