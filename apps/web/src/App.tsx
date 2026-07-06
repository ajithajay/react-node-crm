import { getCurrentSubdomain } from '@/lib/host';
import { AppHostRoutes } from '@/features/auth/AppHostRoutes';
import { WorkspaceHostRoutes } from '@/features/auth/WorkspaceHostRoutes';

export default function App() {
  const subdomain = getCurrentSubdomain();
  return subdomain ? <WorkspaceHostRoutes /> : <AppHostRoutes />;
}
