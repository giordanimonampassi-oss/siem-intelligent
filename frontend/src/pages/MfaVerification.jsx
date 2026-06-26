import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export function MfaVerification({ theme, onVerify, onNavigate, onThemeChange }) {
  const { loginStep2, authError } = useAuth()
  const [codes, setCodes]   = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const inputRefs = useRef([])

  // Focus sur le premier champ au montage
  useEffect(() => { inputRefs.current[0]?.focus() }, [])

  function handleChange(index, value) {
    if (!/^\d?$/.test(value)) return
    const next = [...codes]
    next[index] = value
    setCodes(next)
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !codes[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setCodes(pasted.split(''))
      inputRefs.current[5]?.focus()
    }
  }

  async function handleVerify() {
    const code = codes.join('')
    if (code.length !== 6) {
      setError('Saisissez les 6 chiffres')
      return
    }
    setError('')
    setLoading(true)
    try {
      await loginStep2(code)
      onVerify() // → setIsAuthenticated(true) dans App.jsx
    } catch {
      setError(authError || 'Code invalide ou expiré')
      setCodes(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

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
        <h1>Vérification à deux facteurs</h1>
        <p>Saisissez le code à 6 chiffres de votre application TOTP (Google Authenticator, Authy…)</p>

        {error && (
          <div className="auth-error" role="alert">
            <i className="bi bi-exclamation-triangle-fill"></i> {error}
          </div>
        )}

        <div className="mfa-inputs" onPaste={handlePaste}>
          {codes.map((c, i) => (
            <input
              key={i}
              ref={el => inputRefs.current[i] = el}
              value={c}
              maxLength={1}
              inputMode="numeric"
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              style={error ? { borderColor: 'var(--critical)' } : {}}
            />
          ))}
        </div>

        <button
          type="button"
          className="primary-button w-100"
          onClick={handleVerify}
          disabled={loading || codes.join('').length !== 6}
        >
          {loading
            ? <><i className="bi bi-arrow-repeat spin me-2"></i>Vérification...</>
            : 'Vérifier et accéder'
          }
        </button>

        <div className="d-flex justify-content-between w-100">
          <button type="button" className="text-button">Besoin d'aide ?</button>
          <button
            type="button"
            className="text-button"
            onClick={() => onNavigate('login')}
          >
            Retour
          </button>
        </div>
      </section>
    </main>
  )
}