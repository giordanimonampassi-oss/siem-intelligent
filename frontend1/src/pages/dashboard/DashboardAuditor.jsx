import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getAuditLog, getAuthStats, listUsers } from '../../api/auth.js'
import { reportsAPI } from '../../api/index.js'
import { KpiCard, Card, Badge, EmptyState } from '../../components/ui/index.jsx'
import { FiBook, FiShield, FiDownload, FiCheckCircle, FiAlertCircle } from 'react-icons/fi'
import { format, isToday } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

// Meme helper que les autres pages — tolere {results}, {items} ou tableau brut
function extractList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.items)) return payload.items
  return null
}

// Actions reelles loggees par log_audit() cote backend (auth_service.py,
// alerts.py) — en anglais, pas en francais comme dans l'ancienne version.
const ACTION_COLOR = {
  login:               'var(--sev-success)',
  mfa_verified:        'var(--sev-success)',
  user_created:        'var(--sev-success)',
  user_updated:        'var(--sev-warning)',
  user_disabled:       'var(--sev-critical)',
  alert_acknowledged:  'var(--accent-teal)',
  alert_resolved:      'var(--accent-blue)',
  soar_triggered:      'var(--sev-high)',
}

export default function DashboardAuditor() {
  const { t, i18n } = useTranslation()
  const navigate    = useNavigate()
  const locale      = i18n.language === 'fr' ? fr : enUS

  const [auditLogs,   setAuditLogs]   = useState([])
  const [batches,     setBatches]     = useState([])
  const [activeUsers, setActiveUsers] = useState(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([
      // getAuditLog(skip, limit) — signature reelle de api/auth.js
      getAuditLog(0, 100).catch(() => []),
      reportsAPI.getIntegrityBatches({ size: 5 }).catch(() => ({ data: [] })),
      // /auth/stats n'apparaît pas dans le Swagger officiel — on tente, et on
      // retombe sur un calcul via listUsers() (route confirmée) si ça échoue.
      getAuthStats().catch(() =>
        listUsers(0, 200)
          .then((data) => {
            const users = extractList(data) ?? []
            return { active_users: users.filter((u) => u.is_active).length }
          })
          .catch(() => ({ active_users: null }))
      ),
    ]).then(([auditData, batchRes, statsData]) => {
      setAuditLogs(extractList(auditData) ?? [])
      setBatches(extractList(batchRes.data) ?? [])
      setActiveUsers(statsData?.active_users ?? null)
    }).finally(() => setLoading(false))
  }, [])

  const todayCount = auditLogs.filter(l => l.created_at && isToday(new Date(l.created_at))).length
  const recentLogs = auditLogs.slice(0, 10)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.auditLog')}</h1>
          <p className="page-subtitle">Mode lecture seule — Auditeur</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/reports')}>
          <FiDownload size={14} /> {t('reports.download')}
        </button>
      </div>

      {/* Notice lecture seule */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px',
        background: 'rgba(88,166,255,0.06)',
        border: '1px solid rgba(88,166,255,0.2)',
        borderRadius: 8, marginBottom: 20,
        fontSize: '0.83rem', color: 'var(--text-secondary)',
      }}>
        <FiShield color="var(--accent-blue)" />
        {t('dashboard.readOnlyNotice')} — Accès restreint aux journaux d'audit et rapports.
      </div>

      {/* KPIs — uniquement des valeurs reellement calculees */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KpiCard label="Actions auditées aujourd'hui"
          value={todayCount} color="teal" icon={<FiBook />} />
        <KpiCard label="Vérifications d'intégrité"
          value={`${batches.filter(b => b.verified).length} / ${batches.length}`}
          color="success" icon={<FiShield />} />
        <KpiCard label="Utilisateurs actifs"
          value={activeUsers ?? '—'} color="teal" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        {/* Journal d'audit */}
        <Card
          title={<><FiBook size={14} /> Journal d'audit récent</>}
          actions={
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/audit')}>
              Voir tout
            </button>
          }
        >
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Horodatage</th>
                  <th>Utilisateur</th>
                  <th>Action</th>
                  <th>Cible</th>
                  <th>Résultat</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={5} className="table-empty">{t('common.loading')}</td></tr>
                  : recentLogs.length === 0
                    ? <tr><td colSpan={5}><EmptyState title="Aucune entrée d'audit" /></td></tr>
                    : recentLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                          {log.created_at ? format(new Date(log.created_at), 'dd/MM HH:mm:ss') : '—'}
                        </td>
                        <td style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                          {log.username || '—'}
                        </td>
                        <td>
                          <span style={{
                            fontSize: '0.75rem', fontWeight: 600,
                            color: ACTION_COLOR[log.action] || 'var(--text-secondary)',
                            textTransform: 'uppercase', letterSpacing: '0.03em',
                          }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.target || '—'}
                        </td>
                        <td>
                          {log.result === 'success'
                            ? <FiCheckCircle color="var(--sev-success)" />
                            : <FiAlertCircle color="var(--sev-critical)" />}
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </Card>

        {/* Intégrité */}
        <Card title={<><FiShield size={14} /> Intégrité des lots SHA-256</>}>
          {batches.length === 0
            ? <EmptyState title="Aucun lot archivé" />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {batches.map(b => (
                  <div key={b.id} style={{
                    padding: '10px 12px',
                    background: b.verified ? 'rgba(63,185,80,0.05)' : 'rgba(248,81,73,0.05)',
                    border: `1px solid ${b.verified ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)'}`,
                    borderRadius: 8,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                        {b.log_count?.toLocaleString()} logs
                      </span>
                      <Badge value={b.verified ? 'success' : 'CRITICAL'} />
                    </div>
                    <code style={{ fontSize: '0.65rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                      {b.sha256_hash || '—'}
                    </code>
                  </div>
                ))}
              </div>
            )
          }
        </Card>
      </div>
    </div>
  )
}