import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react' // Importation bien présente
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { FiShield, FiCopy, FiCheck } from 'react-icons/fi'

export default function MFASetupModal({ mfaData }) {
  const { t }                        = useTranslation()
  const { completeMfaSetup, logout } = useAuth()
  const toast                        = useToast()

  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [copied,  setCopied]  = useState(false)
  const inputs = useRef([])

  const secret = mfaData?.secret || 'JBSWY3DPEHPK3PXP'
  const uri    = mfaData?.totp_uri || `otpauth://totp/SmartSIEM?secret=${secret}&issuer=CTU`

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConfirm = async () => {
    if (code.length < 6) return
    setError('')
    setLoading(true)
    try {
      await completeMfaSetup(code)
      toast.success('MFA activé avec succès !')
    } catch {
      setError(t('auth.mfaInvalid'))
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (i, v) => {
    const chars = code.padEnd(6, '').split('')
    const digit = v.replace(/\D/g, '').slice(-1)
    chars[i] = digit
    const next = chars.join('').slice(0, 6)
    setCode(next)
    if (digit && i < 5) inputs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
    if (e.key === 'Enter' && code.length === 6) handleConfirm()
  }

  useEffect(() => {
    if (code.length === 6) handleConfirm()
  }, [code])

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            <FiShield style={{ color: 'var(--accent-teal)', marginRight: 8 }} />
            {t('auth.mfaSetupTitle')}
          </h3>
        </div>

        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>

            {/* QR code dynamique */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                {t('auth.mfaSetupDesc')}
              </p>
              
              {/* VRAI COMPOSANT QR CODE : Propre, net et lisible pour la soutenance */}
              <div style={{
                width: 200, height: 200,
                background: '#fff',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                padding: 12, margin: '0 auto',
                border: '4px solid var(--border-color)',
              }}>
                <QRCodeSVG 
                  value={uri} 
                  size={176}
                  bgColor={"#FFFFFF"}
                  fgColor={"#1a1a2e"}
                  level={"M"}
                />
              </div>

              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  {t('auth.mfaSetupManual')} :
                </p>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8, padding: '8px 12px',
                }}>
                  <code style={{
                    flex: 1, fontSize: '0.78rem',
                    fontFamily: 'JetBrains Mono',
                    color: 'var(--accent-teal)',
                    wordBreak: 'break-all',
                    letterSpacing: '0.1em',
                  }}>
                    {secret}
                  </code>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={copySecret}>
                    {copied ? <FiCheck color="var(--sev-success)" /> : <FiCopy />}
                  </button>
                </div>
              </div>
            </div>

            {/* Saisie du code */}
            <div>
              <h4 style={{ marginBottom: 8, fontSize: '0.95rem' }}>
                Vérifier votre application
              </h4>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
                Après avoir scanné le QR code, saisissez le code à 6 chiffres affiché dans
                Google Authenticator ou Authy pour confirmer la configuration.
              </p>

              {error && (
                <div style={{
                  padding: '8px 12px', background: 'rgba(248,81,73,0.1)',
                  border: '1px solid rgba(248,81,73,0.3)',
                  borderRadius: 8, color: 'var(--sev-critical)',
                  fontSize: '0.83rem', marginBottom: 16,
                }}>
                  {error}
                </div>
              )}

              {/* Cases OTP */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    ref={el => { inputs.current[i] = el }}
                    type="text" inputMode="numeric" maxLength={1}
                    value={code[i] || ''}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    autoFocus={i === 0}
                    style={{
                      width: 44, height: 52,
                      textAlign: 'center',
                      fontSize: '1.3rem',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: 700,
                      background: 'var(--bg-tertiary)',
                      border: `2px solid ${code[i] ? 'var(--accent-teal)' : 'var(--border-color)'}`,
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                  />
                ))}
              </div>

              <button
                className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
                style={{ width: '100%', marginBottom: 10 }}
                onClick={handleConfirm}
                disabled={loading || code.length < 6}
              >
                {!loading && t('auth.mfaConfirm')}
              </button>

              <button
                className="btn btn-ghost"
                style={{ width: '100%', fontSize: '0.82rem' }}
                onClick={logout}
              >
                {t('auth.mfaLater')}
              </button>

              {/* Instructions */}
              <div style={{
                marginTop: 24, padding: 14,
                background: 'rgba(57,213,193,0.06)',
                border: '1px solid rgba(57,213,193,0.2)',
                borderRadius: 8,
              }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--accent-teal)' }}>Applications compatibles :</strong><br />
                  Google Authenticator, Authy, Microsoft Authenticator, 1Password, Bitwarden
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}