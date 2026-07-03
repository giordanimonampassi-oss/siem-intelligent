import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { FiShield, FiMail, FiLock, FiEye, FiEyeOff, FiAlertCircle } from 'react-icons/fi'
import MFASetupModal from './MFASetupModal.jsx'

// ── Particules background ─────────────────────────────────────────────────
function ParticleBg() {
  const dots = Array.from({ length: 28 }, (_, i) => ({
    x: (i * 137.5) % 100,
    y: (i * 97.3)  % 100,
    r: 1 + (i % 3),
    op: 0.06 + (i % 5) * 0.015,
  }))
  return (
<div style={{ marginBottom: 24 }}>
  <img src="/logo.svg" alt="Smart SIEM" style={{ width: 160, height: 'auto' }} />
</div>
  )
}

// ── Composant OTP 6 cases ─────────────────────────────────────────────────
function OTPInput({ value, onChange }) {
  const inputs = useRef([])
  const chars  = value.padEnd(6, '').split('')

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !chars[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  const handleChange = (i, e) => {
    const v = e.target.value.replace(/\D/g, '').slice(-1)
    const next = [...chars]
    next[i] = v
    onChange(next.join('').slice(0, 6))
    if (v && i < 5) inputs.current[i + 1]?.focus()
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    if (pasted.length === 6) inputs.current[5]?.focus()
    e.preventDefault()
  }

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el }}
          type="text" inputMode="numeric" maxLength={1}
          value={chars[i] || ''}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          style={{
            width: 46, height: 54,
            textAlign: 'center',
            fontSize: '1.4rem',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            background: 'var(--bg-tertiary)',
            border: `2px solid ${chars[i] ? 'var(--accent-teal)' : 'var(--border-color)'}`,
            borderRadius: 8,
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
        />
      ))}
    </div>
  )
}

export default function LoginPage() {
  const { t }                  = useTranslation()
  const { loginStep1, loginStep2, authView, setAuthView, initMfaSetup } = useAuth()
  const toast                  = useToast()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [otp,      setOtp]      = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [mfaData,  setMfaData]  = useState(null)

  // ── Étape 1 : login ──────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await loginStep1(email, password)
      if (result.step === 'mfa_setup') {
        const data = await initMfaSetup()
        setMfaData(data)
        setAuthView('mfa_setup')
      }
    } catch (err) {
      const status = err.response?.status
      if (status === 401) setError(t('auth.invalidCredentials'))
      else if (status === 423) setError(t('auth.accountLocked'))
      else setError(err.response?.data?.detail || t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  // ── Étape 2 : TOTP ───────────────────────────────────────────────────
  const handleMfa = async (e) => {
    e?.preventDefault()
    if (otp.length < 6) return
    setError('')
    setLoading(true)
    try {
      await loginStep2(otp)
      toast.success(t('common.success'))
    } catch (err) {
      setError(t('auth.mfaInvalid'))
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  // Auto-submit quand 6 chiffres saisis
  const handleOtpChange = (v) => {
    setOtp(v)
    if (v.length === 6) setTimeout(() => handleMfa(), 100)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <ParticleBg />

      {/* Panneau gauche — branding */}
      <div style={{
        flex: '0 0 40%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 48px',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          width: 80, height: 80,
          background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
          borderRadius: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24,
          boxShadow: 'var(--shadow-glow-teal)',
        }}>
          <FiShield size={40} color="#fff" />
        </div>

        <h1 style={{ fontSize: '2.8rem', fontWeight: 900, marginBottom: 8, textAlign: 'center' }}>
          Smart SIEM
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 48, textAlign: 'center', fontSize: '0.95rem' }}>
          CTU Security Operations Center
        </p>

        {/* Stats animées */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: 280 }}>
          {[
            { label: 'Événements / heure',  value: '50,000+', color: 'var(--accent-teal)' },
            { label: 'Temps de détection',  value: '< 10s',   color: 'var(--sev-success)' },
            { label: 'Modules actifs',      value: '8',        color: 'var(--accent-blue)' },
          ].map(stat => (
            <div key={stat.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
            }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{stat.label}</span>
              <strong style={{ color: stat.color, fontFamily: 'JetBrains Mono' }}>{stat.value}</strong>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 48, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          UCAC/ULC-ICAM — École d'Ingénieurs
        </p>
      </div>

      {/* Panneau droit — formulaire */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 32px',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          width: '100%', maxWidth: 420,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 20,
          padding: '36px 32px',
          boxShadow: 'var(--shadow-lg)',
        }}>
          {/* ── Vue : connexion ── */}
          {authView === 'login' && (
            <>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 6 }}>
                {t('auth.login')}
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: '0.875rem' }}>
                Bienvenue sur le SOC CTU
              </p>

              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px',
                  background: 'rgba(248,81,73,0.1)',
                  border: '1px solid rgba(248,81,73,0.3)',
                  borderRadius: 8, marginBottom: 20,
                  color: 'var(--sev-critical)', fontSize: '0.85rem',
                }}>
                  <FiAlertCircle />
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="form-label">{t('auth.email')}</label>
                  <div className="input-group">
                    <FiMail className="input-icon" />
                    <input
                      className="input"
                      type="email"
                      placeholder="chloe.obrian@ctu.gov"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required autoFocus
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('auth.password')}</label>
                  <div className="input-group">
                    <FiLock className="input-icon" />
                    <input
                      className="input"
                      type={showPwd ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      style={{ paddingRight: 36 }}
                    />
                    <button
                      type="button"
                      className="input-suffix"
                      onClick={() => setShowPwd(v => !v)}
                      tabIndex={-1}
                    >
                      {showPwd ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                  <button type="button" className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--accent-teal)', fontSize: '0.8rem' }}
                  >
                    {t('auth.forgotPassword')}
                  </button>
                </div>

                <button
                  type="submit"
                  className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`}
                  style={{ width: '100%' }}
                  disabled={loading}
                >
                  {!loading && t('auth.loginBtn')}
                </button>
              </form>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                margin: '24px 0', color: 'var(--text-muted)', fontSize: '0.8rem',
              }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                ou
                <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
              </div>

              <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {t('auth.noAccount')}{' '}
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--accent-teal)', padding: 0 }}
                  onClick={() => setAuthView('register')}
                >
                  {t('auth.registerBtn')}
                </button>
              </p>
            </>
          )}

          {/* ── Vue : MFA TOTP ── */}
          {authView === 'mfa' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'rgba(57,213,193,0.1)',
                  border: '2px solid var(--accent-teal)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <FiShield size={26} color="var(--accent-teal)" />
                </div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 6 }}>
                  {t('auth.mfaTitle')}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {t('auth.mfaSubtitle')}
                </p>
              </div>

              {error && (
                <div style={{
                  padding: '10px 14px', background: 'rgba(248,81,73,0.1)',
                  border: '1px solid rgba(248,81,73,0.3)',
                  borderRadius: 8, marginBottom: 20,
                  color: 'var(--sev-critical)', fontSize: '0.85rem', textAlign: 'center',
                }}>
                  {error}
                </div>
              )}

              <OTPInput value={otp} onChange={handleOtpChange} />

              <button
                className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`}
                style={{ width: '100%', marginTop: 24 }}
                onClick={handleMfa}
                disabled={loading || otp.length < 6}
              >
                {!loading && t('auth.mfaVerify')}
              </button>

              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => { setAuthView('login'); setOtp(''); setError('') }}
              >
                {t('common.back')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modal Setup MFA */}
      {authView === 'mfa_setup' && mfaData && (
        <MFASetupModal mfaData={mfaData} />
      )}
    </div>
  )
}