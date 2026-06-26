import { useHealth } from '../hooks/useHealth'

const PAGE_LABELS = {
  dashboard: 'Tableau de bord',
  alerts:    'Alertes en direct',
  logs:      'Recherche de logs',
  incidents: 'Incidents',
  soar:      'Playbooks SOAR',
  ueba:      'Profils UEBA',
  settings:  'Administration',
  profile:   'Profil',
}

export function Topbar({ activePage, theme, onNavigate, onThemeChange }) {
  const { health, allOk } = useHealth()

  function getStatusLabel() {
    if (health.api === 'checking') return 'Vérification...'
    if (!allOk) {
      const down = Object.entries(health)
        .filter(([, v]) => v !== 'ok' && v !== 'checking')
        .map(([k]) => k)
      return `Dégradé — ${down.join(', ')}`
    }
    return 'Tous les systèmes opérationnels'
  }

  const statusColor = health.api === 'checking'
    ? 'var(--warning)'
    : allOk ? 'var(--success)' : 'var(--critical)'

  return (
    <header id="topbar">
      <div className="breadcrumb">
        <span>{PAGE_LABELS[activePage] || activePage}</span>
      </div>

      {/* <div className="topbar-search">
        <i className="ti ti-search" aria-hidden="true"></i>
        <input
          type="text"
          placeholder="Rechercher logs, IP, utilisateurs..."
          onKeyDown={e => { if (e.key === 'Enter') onNavigate('logs') }}
        />
      </div> */}

      <div className="topbar-right">
        {/* Indicateur de santé */}
        <div className="health" title={`PG:${health.postgresql} | ES:${health.elasticsearch}`}>
          <div className="health-dot" style={{ background: statusColor, animation: allOk ? undefined : 'none' }}></div>
          <span style={{ color: statusColor, fontSize: 11 }}>{getStatusLabel()}</span>
        </div>

        {/* Toggle thème */}
        <button
          type="button"
          className="theme-toggle"
          onClick={onThemeChange}
          aria-label="Basculer le thème"
          style={{ fontSize: 11, padding: '4px 8px' }}
        >
          <span className={theme === 'dark' ? 'active' : ''}>Sombre</span>
          <span className={theme === 'light' ? 'active' : ''}>Clair</span>
        </button>

        {/* Cloche notifications */}
        <button className="notif-btn" onClick={() => onNavigate('alerts')}>
          <i className="ti ti-bell" aria-hidden="true"></i>
          <span className="notif-badge">!</span>
        </button>
      </div>
    </header>
  )
}