import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccess, getDefaultRoute } from '../utils/rbac';

export default function ProtectedRoute({ children, path }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (path && !canAccess(user.role, path)) {
    return <Navigate to="/403" replace />;
  }

  return children;
}

export function GuestRoute({ children, allowAuthenticated = false }) {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated && !allowAuthenticated) {
    return <Navigate to={getDefaultRoute(user.role)} replace />;
  }
  return children;
}
