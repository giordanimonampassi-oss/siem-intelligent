import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertTriangle,
  Search,
  Monitor,
  BarChart3,
  UserSearch,
  GitBranch,
  Shield,
  FileText,
  LogOut,
  ShieldCheck,
  Power,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getNavItems } from '../utils/rbac';
import { RoleBadge } from './SeverityBadge';

/**
 * Mapping des icônes pour les éléments de navigation
 * Associe chaque nom d'icône à son composant Lucide React correspondant
 */
const ICONS = {
  LayoutDashboard,
  AlertTriangle,
  Search,
  Monitor,
  BarChart3,
  UserSearch,
  GitBranch,
  Shield,
  FileText,
};

/**
 * Sidebar Component
 *
 * Barre latérale de navigation fixe à gauche de l'application
 * Affiche le logo, les liens de navigation (filtrés par rôle RBAC),
 * le bouton d'isolation d'hôte et les informations utilisateur
 *
 * La navigation est dynamique et s'adapte au rôle de l'utilisateur connecté
 * grâce au système RBAC (Role-Based Access Control)
 *
 * @component
 * @returns {JSX.Element} Barre latérale avec navigation et contrôles utilisateur
 */
export default function Sidebar() {
  // Récupération du contexte d'authentification (utilisateur connecté, fonction logout)
  const { user, logout } = useAuth();
  
  // Hook React Router pour connaître la route actuelle (pour mettre en évidence l'item actif)
  const location = useLocation();
  
  // Hook React Router pour la navigation programmatique
  const navigate = useNavigate();
  
  // Récupération des items de navigation autorisés pour le rôle de l'utilisateur
  // Cette fonction filtre les liens selon les permissions RBAC
  const navItems = getNavItems(user.role);

  /**
   * Gestionnaire de déconnexion
   * Déconnecte l'utilisateur et redirige vers la page de login
   */
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleIsolateHost = () => {
    alert('Isolation d\'hôte simulée - Action critique SOAR');
  };

  return (
    <aside className="sidebar">
      {/* Section brand : Logo et nom de l'application */}
      <div className="sidebar-brand">
        <ShieldCheck size={28} className="brand-icon" />
        <div>
          <strong>Smart SIEM</strong>
          <span>VIGILANT SYSTEM</span>
        </div>
      </div>

      {/* Navigation principale : Liens vers les différentes pages */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          // Récupération de l'icône correspondante depuis le mapping ICONS
          const Icon = ICONS[item.icon];
          // Détermine si l'item est actif (route courante)
          const active = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={`nav-item ${active ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Section actions : Boutons d'action rapide */}
      <div className="sidebar-actions">
        {/* Bouton d'isolation d'hôte - Action critique en cas d'incident */}
        <button type="button" className="isolate-host-btn" onClick={handleIsolateHost}>
          <Power size={16} />
          <span>Isolate Host</span>
        </button>
      </div>

      {/* Section footer : Informations utilisateur et déconnexion */}
      <div className="sidebar-footer">
        {/* Affichage de l'utilisateur connecté avec son rôle */}
        <div className="sidebar-user">
          <div className="user-avatar">{user.avatar}</div>
          <div className="user-info">
            <strong>{user.name}</strong>
            <RoleBadge role={user.role} />
          </div>
        </div>
        {/* Bouton de déconnexion */}
        <button type="button" className="sidebar-logout-btn" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
