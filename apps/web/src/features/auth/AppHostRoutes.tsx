import { Navigate, Route, Routes } from 'react-router';
import { SignupPage } from './pages/SignupPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { AgnosticLoginPage } from './pages/AgnosticLoginPage';
import { CreateWorkspacePage } from './pages/CreateWorkspacePage';
import { SelectWorkspacePage } from './pages/SelectWorkspacePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { TwoFactorChallengePage } from './pages/TwoFactorChallengePage';

/** Routes mounted on the default/landing host (`app.<base>` or the bare base domain). */
export function AppHostRoutes() {
  return (
    <Routes>
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<AgnosticLoginPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/create-workspace" element={<CreateWorkspacePage />} />
      <Route path="/select-workspace" element={<SelectWorkspacePage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/2fa" element={<TwoFactorChallengePage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
