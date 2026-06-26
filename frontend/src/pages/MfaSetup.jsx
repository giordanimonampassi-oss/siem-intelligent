/**
 * MfaSetup — configuration MFA au premier login.
 * Nouveau composant à ajouter dans App.jsx (authView = 'mfa_setup').
 */
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import QRCode from 'qrcode'

export function MfaSetup({ theme, onThemeChange }) {
  const { initMfaSetup, completeMfaSetup, skipMfaSetup } = useAuth()
  const [setupData, setSetupData]   = useState(null)  // { totp_uri, secret }
  const [qrDataUrl, setQrDataUrl]   = useState('')
  const [codes, setCodes]           = useState(['', '', '', '', '', ''])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [step, setStep]             = useState('loading') // 'loading' | 'scan' | 'verify'
  const inputRefs = useRef([])

  useEffect(() => {
    initMfaSetup()
      .then(async (data) => {
        setSetupData(data)
        const url = await QRCode.toDataURL(data.totp_uri, { width: 200, margin: 1 })
        setQrDataUrl(url)
        setStep('scan')
      })
      .catch(() => setStep('scan'))
  }, [])

  function handleChange(index, value) {
    if (!/^\d?$/.test(value)) return
    const next = [...codes]
    next[index] = value
    setCodes(next)
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !codes[index] && index > 0)
      inputRefs.current[index - 1]?.focus()
  }

  async function handleConfirm() {
    const code = codes.join('')
    if (code.length !== 6) { setError('Code incomplet'); return }
    setLoading(true)
    setError('')
    try {
      await completeMfaSetup(code)
      // AuthContext met authStep = 'done' → App.jsx détecte et connecte
    } catch {
      setError('Code invalide — réessayez')
      setCodes(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  if (step === 'loading') {
    return (
      <main className="mfa-page">
        <section className="mfa-card" style={{ alignItems: 'center' }}>
          <i className="bi bi-arrow-repeat spin" style={{ fontSize: 32, color: 'var(--teal)' }}></i>
          <p style={{ marginTop: 12 }}>Génération du secret MFA…</p>
        </section>
      </main>
    )
  }

  return (
    <main className="mfa-page">
      <button
        type="button"
        className="theme-toggle auth-theme-toggle"
        onClick={onThemeChange}
      >
        <span className={theme === 'dark' ? 'active' : ''}>Sombre</span>
        <span className={theme === 'light' ? 'active' : ''}>Clair</span>
      </button>

      <section className="mfa-card">
        <div className="mfa-device">
          <i className="bi bi-shield-lock-fill" aria-hidden="true"></i>
        </div>
        <h1>Sécurisez votre compte — Configuration MFA</h1>
        <p>Scannez le QR code avec Google Authenticator, Authy ou toute application TOTP compatible.</p>

        {qrDataUrl
          ? <img src={qrDataUrl} alt="QR Code MFA" style={{ width: 180, borderRadius: 8, background: '#fff', padding: 8 }} />
          : <div className="qr-code" aria-label="QR Code chargement…"><span></span><span></span><span></span><span></span></div>
        }

        {setupData?.secret && (
          <>
            <code style={{ letterSpacing: 3, fontSize: 13 }}>
              {setupData.secret.match(/.{1,4}/g)?.join(' ')}
            </code>
            <small>Ou saisissez ce code manuellement dans votre application</small>
          </>
        )}

        {error && (
          <div className="auth-error" role="alert">
            <i className="bi bi-exclamation-triangle-fill"></i> {error}
          </div>
        )}

        <div className="mfa-inputs">
          {codes.map((c, i) => (
            <input
              key={i}
              ref={el => inputRefs.current[i] = el}
              value={c}
              maxLength={1}
              inputMode="numeric"
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
            />
          ))}
        </div>

        <button
          type="button"
          className="primary-button w-100"
          onClick={handleConfirm}
          disabled={loading || codes.join('').length !== 6}
        >
          {loading ? 'Activation…' : 'Activer MFA et continuer'}
        </button>

        <button
          type="button"
          className="text-button w-100"
          onClick={skipMfaSetup}
          style={{ color: 'var(--text2)', fontSize: 11 }}
        >
          Configurer plus tard (non recommandé)
        </button>
      </section>
    </main>
  )
}