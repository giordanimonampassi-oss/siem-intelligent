import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext.jsx'
import { useHealth } from '../hooks/useHealth.js'
import { FiShield } from 'react-icons/fi'

export default function HomePage() {
  const { t }    = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { health } = useHealth()
  const [progress, setProgress] = useState(0)

  const initials = (user?.username || 'U')
    .split(/[\s_-]/).map(p => p[0]?.toUpperCase()).join('').slice(0, 2)
  const roleLabel = t(`settings.userRoles.${user?.role}`, user?.role)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 8, 100))
    }, 90)
    const timer = setTimeout(() => navigate('/dashboard'), 1500)
    return () => { clearInterval(interval); clearTimeout(timer) }
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.6rem', fontWeight: 700, color: '#fff',
        boxShadow: 'var(--shadow-glow-teal)',
      }}>
        {initials}
      </div>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>
        {t('auth.welcomeBack')} {user?.username}
      </h2>

      <span className={`badge ${user?.role}`} style={{ fontSize: '0.75rem' }}>{roleLabel}</span>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
        Chargement de votre espace…
      </p>

      <div style={{ width: 240, height: 5, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${progress}%`, height: '100%',
          background: 'var(--accent-teal)', transition: 'width 0.1s linear',
        }} />
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
        {[
          { label: 'PostgreSQL', status: health.postgresql },
          { label: 'Elasticsearch', status: health.elasticsearch },
          { label: 'Syslog', status: health.api },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`health-dot ${s.status === 'ok' ? 'ok' : s.status === 'checking' ? 'warn' : 'error'}`} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}