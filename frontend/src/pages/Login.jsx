export function Login({ theme, onSubmit, onNavigate, onThemeChange }) {
  return (
    <main className="auth-shell">
      <section className="auth-brand-panel">
        <span className="auth-shield">
          <i className="bi bi-shield-fill-check" aria-hidden="true"></i>
        </span>
        <h1>Smart SIEM</h1>
        <p>Système de Gestion et d'Analyse des Événements de Sécurité</p>
        <div className="auth-metrics">
          <span>
            <strong>45,123</strong>
            Événements traités
          </span>
          <span>
            <strong>12</strong>
            Alertes critiques
          </span>
          <span>
            <strong>8</strong>
            Modules actifs
          </span>
        </div>
      </section>

      <section className="auth-form-panel">
        <button
          type="button"
          className="theme-toggle auth-theme-toggle"
          onClick={onThemeChange}
          aria-label="Basculer le thème"
        >
          <span className={theme === 'dark' ? 'active' : ''}>Sombre</span>
          <span className={theme === 'light' ? 'active' : ''}>Clair</span>
        </button>

        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-card-lock">
            <i className="bi bi-lock-fill" aria-hidden="true"></i>
            Connexion
          </div>
          <label>
            Nom d'utilisateur
            <input defaultValue="alex.sokolov" />
          </label>
          <label>
            Mot de passe
            <span className="password-field">
              <input type="password" defaultValue="sentinel" />
              <i className="bi bi-eye-fill" aria-hidden="true"></i>
            </span>
          </label>
          <div className="d-flex justify-content-between gap-3">
            <label className="auth-check">
              <input type="checkbox" /> Se souvenir de moi
            </label>
            <button type="button" className="text-button">
              Mot de passe oublié ?
            </button>
          </div>
          <button type="submit" className="primary-button w-100">
            Se connecter
          </button>
          <button type="button" className="text-button w-100" onClick={() => onNavigate('register')}>
            Créer un compte
          </button>
          <button type="button" className="text-button w-100" onClick={() => onNavigate('landing')}>
            Retour à l'accueil
          </button>
        </form>
      </section>
    </main>
  )
}
