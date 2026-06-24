import { navigationItems } from '../data/navigation'

export function Topbar({ activePage, theme, onNavigate, onThemeChange }) {
  const currentPage =
    navigationItems.find((item) => item.id === activePage) ??
    { label: 'Profil utilisateur' }

  function handleSearchKeyDown(event) {
    if (event.key === 'Enter') {
      onNavigate('logs')
    }
  }

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>SOC</span>
        <span>/</span>
        <strong>{currentPage.label}</strong>
      </div>

      <label className="global-search">
        <span>Recherche</span>
        <input
          placeholder="Rechercher logs, IP, utilisateurs, hôtes..."
          onKeyDown={handleSearchKeyDown}
        />
      </label>

      <div className="topbar-actions">
        <button type="button" className="icon-button" aria-label="Notifications">
          <i className="bi bi-bell-fill" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          className="theme-toggle"
          onClick={onThemeChange}
          aria-label="Basculer le thème"
        >
          <span className={theme === 'dark' ? 'active' : ''}>Sombre</span>
          <span className={theme === 'light' ? 'active' : ''}>Clair</span>
        </button>
        <button
          type="button"
          className={`analyst-card ${activePage === 'profile' ? 'active' : ''}`}
          onClick={() => onNavigate('profile')}
        >
          <strong>Analyste_04</strong>
          <span>Opérateur niveau 2</span>
        </button>
      </div>
    </header>
  )
}
