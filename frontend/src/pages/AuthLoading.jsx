export function AuthLoading({ theme, onThemeChange }) {
  return (
    <main className="auth-status-page">
      <button
        type="button"
        className="theme-toggle auth-theme-toggle"
        onClick={onThemeChange}
        aria-label="Basculer le thème"
      >
        <span className={theme === 'dark' ? 'active' : ''}>Sombre</span>
        <span className={theme === 'light' ? 'active' : ''}>Clair</span>
      </button>

      <section className="auth-status-card">
        <div className="status-avatar">AS</div>
        <h1>Bienvenue, Alex Sokolov</h1>
        <span>Analyste SOC</span>
        <div className="status-line">
          <i></i>
        </div>
        <p>Chargement de votre espace...</p>
        <div className="status-steps">
          <span>Prérequis</span>
          <span>Enrichissement</span>
          <span>Analyse en cours</span>
        </div>
      </section>
    </main>
  )
}
