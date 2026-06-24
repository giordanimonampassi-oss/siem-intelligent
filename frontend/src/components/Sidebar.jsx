import { navigationItems } from '../data/navigation'

const icons = {
  dashboard: 'bi-grid-1x2-fill',
  alerts: 'bi-bell-fill',
  logs: 'bi-database-fill',
  incidents: 'bi-shield-exclamation',
  soar: 'bi-diagram-3-fill',
  ueba: 'bi-person-badge-fill',
  settings: 'bi-gear-fill',
}

export function Sidebar({ activePage, onLogout, onNavigate }) {
  return (
    <aside className="sidebar">
      <button
        type="button"
        className="brand"
        onClick={() => onNavigate('dashboard')}
        aria-label="Tableau de bord Smart SIEM"
      >
        <span className="brand-mark">SI</span>
        <span>
          <strong>Smart SIEM</strong>
          <small>Système vigilant</small>
        </span>
      </button>

      <nav className="nav-list" aria-label="Navigation principale">
        {navigationItems.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <i className={`nav-icon bi ${icons[item.id]}`} aria-hidden="true"></i>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="danger-action">
          <i className="bi bi-hdd-network-fill" aria-hidden="true"></i>
          Isoler l'hôte
        </button>
        <button
          type="button"
          className={`nav-item footer-link ${activePage === 'profile' ? 'active' : ''}`}
          onClick={() => onNavigate('profile')}
        >
          <i className="nav-icon bi bi-person-circle" aria-hidden="true"></i>
          Profil
        </button>
        <button
          type="button"
          className="nav-item footer-link alert-text"
          onClick={onLogout}
        >
          <i className="nav-icon bi bi-box-arrow-right" aria-hidden="true"></i>
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
