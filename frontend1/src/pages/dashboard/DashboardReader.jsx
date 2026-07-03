import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { alertsAPI } from '../../api/index.js'
import { Card, Badge } from '../../components/ui/index.jsx'
import { FiShield, FiRefreshCw, FiArrowRight } from 'react-icons/fi'
import { formatDistanceToNow } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

export default function DashboardReader() {
  const { t, i18n } = useTranslation()
  const navigate    = useNavigate()
  const locale      = i18n.language === 'fr' ? fr : enUS

  const [alerts,   setAlerts]   = useState([])
  const [stats,    setStats]    = useState({})
  const [loading,  setLoading]  = useState(true)
  const [lastUpd,  setLastUpd]  = useState(null)

  const load = async () => {
    try {
      const [aRes, sRes] = await Promise.all([
        alertsAPI.list({ size: 12, sort: '-created_at' }),
        alertsAPI.getStats(),
      ])
      setAlerts(aRes.data?.items || aRes.data || [])
      setStats(sRes.data || {})
      setLastUpd(new Date())
    } catch { /* silencieux */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  const hasCritical = alerts.some(a => a.severity === 'CRITICAL' && a.status === 'NEW')
  const critCount   = alerts.filter(a => a.severity === 'CRITICAL' && a.status === 'NEW').length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('dashboard.title')}</h1>
          <p className="page-subtitle">
            {t('dashboard.readOnlyNotice')}
            {lastUpd && ` — ${t('dashboard.lastUpdated')} ${formatDistanceToNow(lastUpd, { addSuffix: true, locale })}`}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>
          <FiRefreshCw size={14} /> {t('common.refresh')}
        </button>
      </div>

      {/* Notice */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px',
        background: 'rgba(88,166,255,0.06)',
        border: '1px solid rgba(88,166,255,0.2)',
        borderRadius: 8, marginBottom: 20, fontSize: '0.83rem',
        color: 'var(--text-secondary)',
      }}>
        <FiShield color="var(--accent-blue)" />
        {t('dashboard.readOnlyNotice')} — Vous pouvez consulter les alertes mais ne pouvez pas effectuer d'actions.
      </div>

      {/* État système */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Card title="État du système">
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '20px 0', gap: 12,
          }}>
            <div style={{
              width: 70, height: 70, borderRadius: '50%',
              background: hasCritical
                ? 'rgba(248,81,73,0.12)' : 'rgba(63,185,80,0.12)',
              border: `3px solid ${hasCritical ? 'var(--sev-critical)' : 'var(--sev-success)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.8rem',
              animation: hasCritical ? 'pulse-error 1.5s infinite' : undefined,
            }}>
              {hasCritical ? '🔴' : '✅'}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '1rem', fontWeight: 700,
                color: hasCritical ? 'var(--sev-critical)' : 'var(--sev-success)',
              }}>
                {hasCritical ? `${critCount} incident(s) critique(s)` : t('dashboard.noCritical')}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {stats.total_active || 0} alertes actives au total
              </div>
            </div>
          </div>
        </Card>

        <Card title="Dernière mise à jour">
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '20px 0', gap: 8,
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'JetBrains Mono', color: 'var(--accent-teal)' }}>
              {lastUpd ? lastUpd.toLocaleTimeString() : '—'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Rafraîchissement automatique toutes les 15s
            </div>
            <div style={{
              width: '100%', height: 4, background: 'var(--bg-tertiary)',
              borderRadius: 2, overflow: 'hidden', maxWidth: 200,
            }}>
              <div style={{
                height: '100%', background: 'var(--accent-teal)',
                animation: 'shimmer 15s linear infinite',
                backgroundSize: '200%',
              }} />
            </div>
          </div>
        </Card>
      </div>

      {/* Bouton Crisis Room */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {hasCritical ? (
          <button
            className="btn btn-danger btn-lg"
            onClick={() => navigate('/crisis')}
            style={{
              padding: '14px 32px', fontSize: '1rem',
              animation: 'pulse-error 2s infinite',
              boxShadow: 'var(--shadow-glow-critical)',
            }}
          >
            🔴 {t('dashboard.openCrisisRoom')}
          </button>
        ) : (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '14px 32px',
            background: 'rgba(63,185,80,0.08)',
            border: '1px solid rgba(63,185,80,0.25)',
            borderRadius: 12, color: 'var(--sev-success)',
            fontSize: '0.95rem', fontWeight: 600,
          }}>
            ✅ {t('dashboard.noCritical')}
          </div>
        )}
      </div>

      {/* Liste alertes en lecture seule */}
      <Card
        title={t('dashboard.latestAlerts')}
        actions={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/alerts')}>
            {t('common.viewAll')} <FiArrowRight size={13} />
          </button>
        }
      >
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{t('common.severity')}</th>
                <th>Titre</th>
                <th>{t('alerts.sourceIP')}</th>
                <th>Heure</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={5} className="table-empty">{t('common.loading')}</td></tr>
                : alerts.length === 0
                  ? <tr><td colSpan={5} className="table-empty">{t('alerts.noAlerts')}</td></tr>
                  : alerts.map(a => (
                    <tr key={a.id}>
                      <td><Badge value={a.severity} /></td>
                      <td style={{ fontSize: '0.85rem' }}>{a.title || a.alert_id || '—'}</td>
                      <td>
                        <code style={{ fontSize: '0.75rem', color: 'var(--accent-teal)' }}>
                          {a.source_ip || '—'}
                        </code>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {a.created_at
                          ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale })
                          : '—'}
                      </td>
                      <td><Badge value={a.status} /></td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}