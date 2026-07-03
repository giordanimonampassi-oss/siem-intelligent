import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { login } from '../../api/auth.js'
import {
  FiShield, FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiCheckCircle
} from 'react-icons/fi'

function strengthScore(pwd) {
  let s = 0
  if (pwd.length >= 8)  s++
  if (pwd.length >= 12) s++
  if (/[A-Z]/.test(pwd)) s++
  if (/[0-9]/.test(pwd)) s++
  if (/[^A-Za-z0-9]/.test(pwd)) s++
  return s
}

export default function RegisterPage({ onBack }) {
  const { t }   = useTranslation()
  const toast   = useToast()

  const [form, setForm] = useState({
    username: '', email: '', password: '', confirm: '',
  })
  const [showPwd,   setShowPwd]   = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [done,      setDone]      = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const score  = strengthScore(form.password)
  const levels = ['', t('auth.weak'), t('auth.weak'), t('auth.medium'), t('auth.strong'), t('auth.strong')]
  const colors = ['', 'var(--sev-critical)', 'var(--sev-high)', 'var(--sev-warning)', 'var(--sev-success)', 'var(--sev-success)']

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (score < 2) {
      setError('Mot de passe trop faible.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await authAPI.createUser({
        username: form.username,
        email:    form.email,
        password: form.password,
        role:     'READER',
      })
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.detail || t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <FiCheckCircle size={52} color="var(--sev-success)" style={{ marginBottom: 20 }} />
      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 10 }}>
        Compte créé avec succès !
      </h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: '0.875rem' }}>
        {t('auth.pending')}
      </p>
      <button className="btn btn-primary" onClick={onBack}>
        {t('auth.login')}
      </button>
    </div>
  )

  return (
    <>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 6 }}>
        {t('auth.register')}
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.875rem' }}>
        Rejoindre le SOC CTU
      </p>

      {error && (
        <div style={{
          padding: '10px 14px', background: 'rgba(248,81,73,0.1)',
          border: '1px solid rgba(248,81,73,0.3)',
          borderRadius: 8, color: 'var(--sev-critical)',
          fontSize: '0.85rem', marginBottom: 16,
        }}>{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">{t('auth.username')}</label>
          <div className="input-group">
            <FiUser className="input-icon" />
            <input className="input" placeholder="jack.bauer"
              value={form.username} onChange={set('username')} required />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{t('auth.email')}</label>
          <div className="input-group">
            <FiMail className="input-icon" />
            <input className="input" type="email" placeholder="jack@ctu.gov"
              value={form.email} onChange={set('email')} required />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{t('auth.password')}</label>
          <div className="input-group">
            <FiLock className="input-icon" />
            <input className="input" type={showPwd ? 'text' : 'password'}
              placeholder="••••••••" value={form.password} onChange={set('password')}
              required style={{ paddingRight: 36 }} />
            <button type="button" className="input-suffix" onClick={() => setShowPwd(v => !v)}>
              {showPwd ? <FiEyeOff size={15} /> : <FiEye size={15} />}
            </button>
          </div>
          {form.password && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: i <= score ? colors[score] : 'var(--bg-tertiary)',
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>
              <span style={{ fontSize: '0.72rem', color: colors[score] }}>
                {t('auth.passwordStrength')} : {levels[score]}
              </span>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">{t('auth.confirmPassword')}</label>
          <div className="input-group">
            <FiLock className="input-icon" />
            <input className="input" type="password" placeholder="••••••••"
              value={form.confirm} onChange={set('confirm')} required />
          </div>
          {form.confirm && form.password !== form.confirm && (
            <p className="form-error">Les mots de passe ne correspondent pas</p>
          )}
        </div>

        <button type="submit"
          className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`}
          style={{ width: '100%' }} disabled={loading}>
          {!loading && t('auth.registerBtn')}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        {t('auth.hasAccount')}{' '}
        <button className="btn btn-ghost btn-sm"
          style={{ color: 'var(--accent-teal)', padding: 0 }} onClick={onBack}>
          {t('auth.loginBtn')}
        </button>
      </p>
    </>
  )
}