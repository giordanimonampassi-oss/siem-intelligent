import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDefaultRoute } from '../utils/rbac';

export default function ForbiddenPage() {
  const { user } = useAuth();

  return (
    <div className="forbidden-page">
      <ShieldOff size={64} />
      <h1>403 — Accès refusé</h1>
      <p>
        Votre rôle <strong>{user?.role}</strong> ne vous permet pas d&apos;accéder à cette page.
      </p>
      <Link to={getDefaultRoute(user?.role)} className="btn btn-primary">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
