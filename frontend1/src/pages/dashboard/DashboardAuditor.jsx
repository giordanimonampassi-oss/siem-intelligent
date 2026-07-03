import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getAuditLog } from '../../api/auth.js'
import { getBatchIntegrity } from '../../api/index.js'
import { ingestLog } from '../../api/logs.js'
import { KpiCard, Card, Badge, EmptyState } from '../../components/ui/index.jsx'
import { FiBook, FiShield, FiDownload, FiCheckCircle, FiAlertCircle } from 'react-icons/fi'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

export default function DashboardAuditor() {
  const { t, i18n } = useTranslation()
  const navigate    = useNavigate()
  const locale      = i18n.language === 'fr' ? fr : enUS

  const [auditLogs, setAuditLogs] = useState([])
  const [batches,   setBatches]   = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      getAuditLog({ size: 10 }),
      getBatchIntegrity({ size: 5 }).catch(() => ({ data: [] })),
    ]).then(([auditRes, batchRes]) => {
      setAuditLogs(auditRes.data?.items || auditRes.data || [])
      setBatches(batchRes.data?.items || batchRes.data || [])
    }).finally(() => setLoading(false))
  }, [])

  const ACTION_COLOR = {
    connexion:           'var(--sev-success)',
    deconnexion:         'var(--text-muted)',
    connexion_echouee:   'var(--sev-critical)',
    creation_utilisateur:'var(--sev-success)',
    modification_role:   'var(--sev-warning)',
    consultation_alerte: 'var(--accent-teal)',
    traitement_incident: 'var(--accent-blue)',
    execution_playbook:  'var(--sev-high)',
    export:              'var(--accent-purple)',
  }

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

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KpiCard label="Actions auditées aujourd'hui"
          value={auditLogs.length} color="teal" icon={<FiBook />} />
        <KpiCard label="Vérifications d'intégrité"
          value={`${batches.filter(b => b.verified).length} / ${batches.length}`}
          color="success" icon={<FiShield />} />
        <KpiCard label="Logs exportés ce mois" value="847" color="info" />
        <KpiCard label="Utilisateurs actifs" value="12" color="teal" />
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
                  : auditLogs.length === 0
                    ? <tr><td colSpan={5}><EmptyState title="Aucune entrée d'audit" /></td></tr>
                    : auditLogs.map(log => (
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