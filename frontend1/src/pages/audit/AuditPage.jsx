import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getAuditLog } from '../../api/auth.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Card, EmptyState, Pagination } from '../../components/ui/index.jsx'
import { FiBook, FiDownload, FiFilter, FiCheckCircle, FiAlertCircle } from 'react-icons/fi'
import { format } from 'date-fns'

// Actions réellement loggées par log_audit() côté backend (auth_service.py,
// alerts.py, logs.py) — en anglais, pas en français. Cohérent avec
// DashboardAuditor.jsx.
const ACTIONS = ['', 'login', 'mfa_verified', 'user_created', 'user_updated',
  'user_disabled', 'log_ingested', 'batch_ingested', 'log_flagged',
  'alert_acknowledged', 'alert_resolved', 'soar_triggered']

const ACTION_COLOR = {
  login:               'var(--sev-success)',
  mfa_verified:        'var(--sev-success)',
  user_created:        'var(--sev-success)',
  user_updated:        'var(--sev-warning)',
  user_disabled:       'var(--sev-critical)',
  log_ingested:        'var(--text-muted)',
  batch_ingested:      'var(--text-muted)',
  log_flagged:         'var(--sev-warning)',
  alert_acknowledged:  'var(--accent-teal)',
  alert_resolved:      'var(--accent-blue)',
  soar_triggered:      'var(--sev-high)',
}

// Même helper que les autres pages — tolère {results}, {items} ou tableau brut
function extractList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

export default function AuditPage() {
  const { t }   = useTranslation()
  const toast   = useToast()
  const [allLogs, setAllLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(1)
  const [action,  setAction]  = useState('')
  const [username,setUsername]= useState('')
  const SIZE = 25

  // Pas de filtre serveur confirmé par action/username sur GET /auth/audit —
  // on charge une fenêtre large une fois, puis on filtre/pagine côté client.
  const load = async () => {
    setLoading(true)
    try {
      const data = await getAuditLog(0, 500)
      setAllLogs(extractList(data))
    } catch {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = allLogs.filter(l => {
    if (action && l.action !== action) return false
    if (username && !(l.username || '').toLowerCase().includes(username.toLowerCase())) return false
    return true
  })

  const total = filtered.length
  const logs  = filtered.slice((page - 1) * SIZE, page * SIZE)

  const applyFilters = () => setPage(1)

  const exportCSV = () => {
    const header = 'timestamp,username,action,target,result\n'
    const rows = filtered.map(l =>
      `"${l.created_at}","${l.username || ''}","${l.action}","${l.target || ''}","${l.result}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `audit_log_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Export téléchargé')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.auditLog')}</h1>
          <p className="page-subtitle">{total} entrée(s)</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={exportCSV}>
          <FiDownload size={14} /> {t('common.export')}
        </button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="form-label">Utilisateur</label>
            <input className="input" value={username} onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()} placeholder="Rechercher…" />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label className="form-label">Action</label>
            <select className="select" value={action} onChange={e => { setAction(e.target.value); setPage(1) }}>
              {ACTIONS.map(a => <option key={a} value={a}>{a || t('common.all')}</option>)}
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" onClick={applyFilters}>
              <FiFilter size={14} /> {t('common.apply')}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}</div>
        ) : logs.length === 0 ? (
          <EmptyState icon={<FiBook size={36} />} title="Aucune entrée d'audit" />
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Horodatage</th><th>Utilisateur</th><th>Action</th><th>Cible</th><th>IP</th><th>Résultat</th></tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {log.created_at ? format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss') : '—'}
                      </td>
                      <td style={{ fontWeight: 500, fontSize: '0.85rem' }}>{log.username || '—'}</td>
                      <td>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                          color: ACTION_COLOR[log.action] || 'var(--text-secondary)',
                        }}>{log.action}</span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.target || '—'}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {log.ip_address || '—'}
                      </td>
                      <td>
                        {log.result === 'success'
                          ? <FiCheckCircle color="var(--sev-success)" />
                          : <FiAlertCircle color="var(--sev-critical)" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={total} size={SIZE} onChange={p => setPage(p)} />
          </>
        )}
      </Card>
    </div>
  )
}