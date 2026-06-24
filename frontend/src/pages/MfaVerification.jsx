export function MfaVerification({ theme, onVerify, onNavigate, onThemeChange }) {
  return (
    <main className="mfa-page">
      <button
        type="button"
        className="theme-toggle auth-theme-toggle"
        onClick={onThemeChange}
        aria-label="Basculer le thème"
      >
        <span className={theme === 'dark' ? 'active' : ''}>Sombre</span>
        <span className={theme === 'light' ? 'active' : ''}>Clair</span>
      </button>

      <section className="mfa-card">
        <div className="mfa-device">
          <i className="bi bi-phone-fill" aria-hidden="true"></i>
        </div>
        <h1>Sécurisez votre compte — Configuration MFA</h1>
        <p>
          Renforcez votre posture de sécurité en activant l'authentification multifacteur.
        </p>
        <div className="qr-code" aria-label="Code QR de configuration MFA">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <code>HXT3 U9P2 3WMY 9Y2S</code>
        <small>
          Scannez le code QR avec Google Authenticator, Authy ou toute application TOTP compatible.
        </small>
        <div className="mfa-inputs">
          {Array.from({ length: 6 }).map((_, index) => (
            <input key={index} maxLength="1" inputMode="numeric" />
          ))}
        </div>
        <button type="button" className="primary-button w-100" onClick={onVerify}>
          Activer MFA et continuer
        </button>
        <div className="d-flex justify-content-between w-100">
          <button type="button" className="text-button">
            Besoin d'aide ?
          </button>
          <button type="button" className="text-button" onClick={() => onNavigate('login')}>
            Déconnexion
          </button>
        </div>
      </section>
    </main>
  )
}
