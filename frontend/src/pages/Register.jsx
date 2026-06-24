export function Register({ theme, onSubmit, onNavigate, onThemeChange }) {
  return (
    <main className="signup-page">
      <nav className="marketing-nav compact">
        <button type="button" className="marketing-brand" onClick={() => onNavigate('landing')}>
          <i className="bi bi-shield-lock-fill" aria-hidden="true"></i>
          Smart SIEM
        </button>
        <div className="marketing-links">
          <a href="#features">Fonctionnalités</a>
          <a href="#solutions">Solutions</a>
          <a href="#docs">Documentation</a>
          <a href="#pricing">Tarifs</a>
        </div>
        <button type="button" className="text-button" onClick={() => onNavigate('login')}>
          Connexion
        </button>
        <button
          type="button"
          className="theme-toggle public-theme-toggle"
          onClick={onThemeChange}
          aria-label="Basculer le thème"
        >
          <span className={theme === 'dark' ? 'active' : ''}>Sombre</span>
          <span className={theme === 'light' ? 'active' : ''}>Clair</span>
        </button>
        <button type="button" className="primary-button" onClick={() => onNavigate('register')}>
          Démarrer
        </button>
      </nav>

      <section className="signup-layout">
        <div className="signup-copy">
          <h1>Sécurisez votre infrastructure avec</h1>
          <p>
            Rejoignez les entreprises qui utilisent la détection pilotée par l'IA
            pour garder une longueur d'avance sur les cyberattaques sophistiquées.
          </p>
          <div className="signup-benefits">
            <article>
              <i className="bi bi-activity" aria-hidden="true"></i>
              <span>Surveillance 24/7</span>
              <p>Visibilité en temps réel sur tout votre environnement numérique, à chaque instant.</p>
            </article>
            <article>
              <i className="bi bi-lightning-fill" aria-hidden="true"></i>
              <span>Réponse automatisée</span>
              <p>Protocoles de confinement autonomes déclenchés dès la validation d'une menace.</p>
            </article>
            <article>
              <i className="bi bi-globe2" aria-hidden="true"></i>
              <span>Renseignement global</span>
              <p>Exploitez l'intelligence partagée issue d'un réseau mondial de capteurs.</p>
            </article>
          </div>
          <div className="trusted-row">
            <span></span>
            <span></span>
            <span></span>
            <small>Adopté par plus de 5 000 équipes sécurité dans le monde</small>
          </div>
        </div>

        <form className="signup-card" onSubmit={onSubmit}>
          <h2>Créer un compte</h2>
          <p>Démarrez votre essai gratuit de 14 jours.</p>
          <label>
            Nom complet
            <input defaultValue="Jean Dupont" />
          </label>
          <label>
            Email professionnel
            <input type="email" defaultValue="jean@entreprise.com" />
          </label>
          <label>
            Nom de l'entreprise
            <input defaultValue="Acme SARL" />
          </label>
          <label>
            Mot de passe
            <span className="password-field">
              <input type="password" defaultValue="sentinel" />
              <i className="bi bi-eye-fill" aria-hidden="true"></i>
            </span>
          </label>
          <label className="auth-check">
            <input type="checkbox" defaultChecked /> J'accepte les conditions
            d'utilisation et la politique de confidentialité.
          </label>
          <button type="submit" className="primary-button w-100">
            Créer le compte
          </button>
          <button type="button" className="text-button w-100" onClick={() => onNavigate('login')}>
            Vous avez déjà un compte ? Connexion
          </button>
        </form>
      </section>

      <footer className="signup-footer">
        <span>
          <i className="bi bi-shield-lock-fill" aria-hidden="true"></i>
          Smart SIEM
        </span>
        <small>© 2026 Smart SIEM. Tous droits réservés.</small>
        <nav aria-label="Liens légaux">
          <a href="#privacy">Confidentialité</a>
          <a href="#terms">Conditions d'utilisation</a>
          <a href="#security">Sécurité</a>
          <a href="#support">Support</a>
        </nav>
      </footer>
    </main>
  )
}
