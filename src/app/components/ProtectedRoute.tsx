import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
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
