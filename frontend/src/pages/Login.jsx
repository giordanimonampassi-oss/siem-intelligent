import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export function Login({ theme, onNavigate, onThemeChange }) {
  const { loginStep1, authError } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [localError, setLocalError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLocalError('')
    if (!email || !password) {
      setLocalError('Email et mot de passe requis')
      return
    }
    setLoading(true)
    try {
      const result = await loginStep1(email, password)
      if (result.mfa_required) {
        onNavigate('mfa')
      } else if (!result.user.mfa_enabled) {
        onNavigate('mfa_setup')
      } else {
        onNavigate('loading')
      }
    } catch {
      // L'erreur est dans authError via le context
    } finally {
      setLoading(false)
    }
  }

  const error = localError || authError

  return (
    <main className="auth-shell">
      <section className="auth-brand-panel">
        <span className="auth-shield">
          <i className="bi bi-shield-fill-check" aria-hidden="true"></i>
        </span>
        <h1>Smart SIEM</h1>
        <p>Système de Gestion et d'Analyse des Événements de Sécurité</p>
        <div className="auth-metrics">
          <span><strong>CTU</strong>Security Ops</span>
          <span><strong>UCAC</strong>ICAM</span>
          <span><strong>v1.0</strong>Module 1&2</span>
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

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-card-lock">
            <i className="bi bi-lock-fill" aria-hidden="true"></i>
            Connexion
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <i className="bi bi-exclamation-triangle-fill"></i> {error}
            </div>
          )}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vous@ctu.gov"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Mot de passe
            <span className="password-field">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <i
                className={`bi ${showPwd ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setShowPwd(v => !v)}
                aria-hidden="true"
              />
            </span>
          </label>

          <button
            type="submit"
            className="primary-button w-100"
            disabled={loading}
          >
            {loading
              ? <><i className="bi bi-arrow-repeat spin me-2"></i>Connexion...</>
              : 'Se connecter'
            }
          </button>

          <button
            type="button"
            className="text-button w-100"
            onClick={() => onNavigate('landing')}
          >
            Retour à l'accueil
          </button>
        </form>
      </section>
    </main>
  )
}