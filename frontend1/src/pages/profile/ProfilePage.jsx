import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { login } from '../../api/auth.js'
import { Card, Badge } from '../../components/ui/index.jsx'
import {
  FiUser, FiCamera, FiLock, FiShield, FiSave,
  FiEye, FiEyeOff, FiCheckCircle
} from 'react-icons/fi'

export default function ProfilePage() {
  const { t }                 = useTranslation()
  const { user, updateUserLocal } = useAuth()
  const toast                  = useToast()
  const fileRef                = useRef()

  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || null)
  const [username, setUsername] = useState(user?.username || '')
  const [email,    setEmail]    = useState(user?.email || '')
  const [saving,   setSaving]   = useState(false)

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd,      setNewPwd]    = useState('')
  const [showPwd,     setShowPwd]   = useState(false)
  const [pwdSaving,   setPwdSaving] = useState(false)

  const initials = (user?.username || 'U')
    .split(/[\s_-]/).map(p => p[0]?.toUpperCase()).join('').slice(0, 2)

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview immédiate
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result)
    reader.readAsDataURL(file)

    try {
      const { data } = await authAPI.uploadAvatar(file)
      updateUserLocal({ avatar_url: data.avatar_url })
      toast.success('Photo de profil mise à jour')
    } catch {
      toast.error(t('common.error'))
    }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await authAPI.updateProfile({ username, email })
      updateUserLocal({ username, email })
      toast.success(t('profile.saveProfile') + ' — OK')
    } catch {
      toast.error(t('common.error'))
    } finally { setSaving(false) }
  }

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd) return
    setPwdSaving(true)
    try {
      await authAPI.changePassword({ current_password: currentPwd, new_password: newPwd })
      toast.success(t('profile.changePassword') + ' — OK')
      setCurrentPwd(''); setNewPwd('')
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'))
    } finally { setPwdSaving(false) }
  }

  const roleLabel = t(`settings.userRoles.${user?.role}`, user?.role)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('profile.title')}</h1>
          <p className="page-subtitle">Gérez vos informations personnelles et votre sécurité</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        {/* Carte profil + avatar */}
        <Card>
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
              <div style={{
                width: 100, height: 100, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2rem', fontWeight: 700, color: '#fff',
                overflow: 'hidden', margin: '0 auto',
              }}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--accent-teal)', border: '3px solid var(--bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#0D1117',
                }}
                title={t('profile.changeAvatar')}
              >
                <FiCamera size={14} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{user?.username}</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 10 }}>{user?.email}</p>
            <Badge value={user?.role} />

            <div className="section-divider" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
              <Row label={t('profile.teamScope')} value={user?.team_scope || '—'} />
              <Row label={t('profile.riskScore')} value={`${user?.risk_score ?? 0} / 100`} />
            </div>
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Infos personnelles */}
          <Card title={<><FiUser size={14} /> {t('profile.personalInfo')}</>}>
            <div className="form-group">
              <label className="form-label">{t('auth.username')}</label>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('auth.email')}</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <button
              className={`btn btn-primary ${saving ? 'btn-loading' : ''}`}
              onClick={handleSaveProfile} disabled={saving}
            >
              {!saving && <><FiSave size={14} /> {t('profile.saveProfile')}</>}
            </button>
          </Card>

          {/* Sécurité */}
          <Card title={<><FiLock size={14} /> {t('profile.security')}</>}>
            <div className="form-group">
              <label className="form-label">{t('profile.currentPassword')}</label>
              <div className="input-group">
                <FiLock className="input-icon" />
                <input className="input" type={showPwd ? 'text' : 'password'}
                  value={currentPwd} onChange={e => setCurrentPwd(e.target.value)}
                  style={{ paddingRight: 36 }} />
                <button type="button" className="input-suffix" onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('profile.newPassword')}</label>
              <input className="input" type="password"
                value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            </div>
            <button
              className={`btn btn-secondary ${pwdSaving ? 'btn-loading' : ''}`}
              onClick={handleChangePassword} disabled={pwdSaving || !currentPwd || !newPwd}
            >
              {!pwdSaving && t('profile.changePassword')}
            </button>
          </Card>

          {/* MFA */}
          <Card title={<><FiShield size={14} /> {t('profile.mfaSection')}</>}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
              background: user?.mfa_enabled ? 'rgba(63,185,80,0.06)' : 'rgba(210,153,34,0.06)',
              border: `1px solid ${user?.mfa_enabled ? 'rgba(63,185,80,0.2)' : 'rgba(210,153,34,0.3)'}`,
              borderRadius: 8,
            }}>
              {user?.mfa_enabled
                ? <FiCheckCircle color="var(--sev-success)" size={20} />
                : <FiShield color="var(--sev-warning)" size={20} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {user?.mfa_enabled ? t('profile.mfaActive') : t('profile.mfaInactive')}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Authentification à deux facteurs (TOTP)
                </div>
              </div>
              {user?.mfa_enabled && (
                <button className="btn btn-secondary btn-sm">{t('profile.resetMfa')}</button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  )
}