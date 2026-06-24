export function Landing({ theme, onNavigate, onThemeChange }) {
  const featureCards = [
    [
      'bi-radar',
      'Détection des menaces en temps réel',
      "Surveillez les journaux en continu avec un scoring IA quasi instantané pour repérer les comportements anormaux.",
      'Explorer le moteur +',
    ],
    [
      'bi-lightning-charge-fill',
      'Playbooks SOAR automatisés',
      "Réduisez la fatigue d'alerte avec des workflows de réponse prêts à l'emploi, de l'isolation utilisateur aux mises à jour de pare-feu.",
      'Hub automatisation +',
    ],
    [
      'bi-person-badge-fill',
      'Profils UEBA avancés',
      "Identifiez les écarts de comportement avant qu'ils ne deviennent des incidents critiques.",
      'Analyse utilisateur +',
    ],
  ]

  return (
    <main className="marketing-page">
      <nav className="marketing-nav">
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
        <div className="marketing-actions">
          <button
            type="button"
            className="theme-toggle public-theme-toggle"
            onClick={onThemeChange}
            aria-label="Basculer le thème"
          >
            <span className={theme === 'dark' ? 'active' : ''}>Sombre</span>
            <span className={theme === 'light' ? 'active' : ''}>Clair</span>
          </button>
          <button type="button" className="text-button" onClick={() => onNavigate('login')}>
            Connexion
          </button>
          <button type="button" className="primary-button" onClick={() => onNavigate('register')}>
            Démarrer
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <span className="eyebrow">Plateforme SOC nouvelle génération</span>
          <h1>Opérations de sécurité nouvelle génération,</h1>
          <p>
            Stoppez les menaces avant qu'elles ne franchissent votre périmètre.
            Smart SIEM combine UEBA avancé, corrélation temps réel et SOAR automatisé
            dans une plateforme unique de cyberdéfense.
          </p>
          <div className="d-flex flex-wrap gap-3">
            <button type="button" className="primary-button" onClick={() => onNavigate('register')}>
              Démarrer
            </button>
            <button type="button" className="secondary-button" onClick={() => onNavigate('login')}>
              Voir la démo
            </button>
          </div>
        </div>

        <div className="hero-console" aria-label="Aperçu du tableau de bord des opérations de sécurité">
          <div className="console-top">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="console-grid">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="console-chart">
            <i></i>
            <i></i>
            <i></i>
            <i></i>
            <i></i>
          </div>
          <strong>14,2 s</strong>
        </div>
      </section>

      <section className="landing-section" id="features">
        <div className="section-heading">
          <h2>Gestion unifiée des menaces</h2>
          <p>
            Une seule plateforme pour détecter, investiguer et répondre aux
            cybermenaces sur l'ensemble de votre périmètre numérique.
          </p>
        </div>
        <div className="row g-4">
          {featureCards.map(([icon, title, text, link]) => (
            <div className="col-12 col-md-4" key={title}>
              <article className="feature-card h-100">
                <i className={`bi ${icon}`} aria-hidden="true"></i>
                <h3>{title}</h3>
                <p>{text}</p>
                <span>{link}</span>
              </article>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section landing-proof" id="solutions">
        <div className="proof-visual"></div>
        <div className="proof-stats">
          <article>
            <strong>99.99%</strong>
            <span>Disponibilité fiable</span>
            <p>Disponibilité critique pour les opérations SOC d'entreprise.</p>
          </article>
          <article>
            <strong>1,200+</strong>
            <span>Intégrations natives</span>
            <p>Connectez vos outils cloud, identité, endpoint et sécurité réseau.</p>
          </article>
        </div>
      </section>

      <footer className="marketing-footer">
        <div>
          <strong>Smart SIEM</strong>
          <p>Protection du périmètre numérique par la corrélation d'événements et la réponse autonome.</p>
        </div>
        <nav aria-label="Liens de pied de page">
          <a href="#privacy">Confidentialité</a>
          <a href="#terms">Conditions d'utilisation</a>
          <a href="#security">Sécurité</a>
          <a href="#support">Support</a>
        </nav>
        <span>© 2026 Smart SIEM. Tous droits réservés.</span>
      </footer>
    </main>
  )
}
