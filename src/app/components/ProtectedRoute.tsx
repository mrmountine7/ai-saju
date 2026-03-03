import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useAnalysisMode } from '@/contexts/AnalysisModeContext';
import { MODE_THEMES } from '@/contexts/ThemeContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  requireExpert?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requireAuth = true,
  requireExpert = false 
}: ProtectedRouteProps) {
  const { isAuthenticated, isExpertUser, loading } = useAuth();
  const location = useLocation();
  const { mode } = useAnalysisMode();
  const theme = MODE_THEMES[mode];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.bgGradient }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requireExpert && !isExpertUser) {
    return <Navigate to="/expert/subscription" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
