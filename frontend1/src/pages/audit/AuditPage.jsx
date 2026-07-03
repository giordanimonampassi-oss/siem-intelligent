import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { login } from '../../api/auth.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Card, EmptyState, Pagination } from '../../components/ui/index.jsx'
import { FiBook, FiDownload, FiFilter, FiCheckCircle, FiAlertCircle } from 'react-icons/fi'
import { format } from 'date-fns'

const ACTIONS = ['', 'connexion', 'deconnexion', 'connexion_echouee',
  'creation_utilisateur', 'modification_role', 'consultation_alerte',
  'traitement_incident', 'execution_playbook', 'export']

export default function AuditPage() {
  const { t }   = useTranslation()
  const toast   = useToast()
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [action,  setAction]  = useState('')
  const [username,setUsername]= useState('')
  const SIZE = 25

  const load = async (p = 1) => {
    setLoading(true)
    try {
      const params = { page: p, size: SIZE }
      if (action) params.action = action
      if (username) params.username = username
      const { data } = await authAPI.getAuditLog(params)
      setLogs(data.items || data || [])
      setTotal(data.total || (data.items || data || []).length)
    } catch { toast.error(t('common.error')) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(1) }, [action])

  const exportCSV = () => {
    const header = 'timestamp,username,action,target,result\n'
    const rows = logs.map(l =>
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

  const ACTION_COLOR = {
    connexion: 'var(--sev-success)',
    deconnexion: 'var(--text-muted)',
    connexion_echouee: 'var(--sev-critical)',
    creation_utilisateur: 'var(--sev-success)',
    modification_role: 'var(--sev-warning)',
    consultation_alerte: 'var(--accent-teal)',
    traitement_incident: 'var(--accent-blue)',
    execution_playbook: 'var(--sev-high)',
    export: 'var(--accent-purple)',
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
              onKeyDown={e => e.key === 'Enter' && load(1)} placeholder="Rechercher…" />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label className="form-label">Action</label>
            <select className="select" value={action} onChange={e => setAction(e.target.value)}>
              {ACTIONS.map(a => <option key={a} value={a}>{a || t('common.all')}</option>)}
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => load(1)}>
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
            <Pagination page={page} total={total} size={SIZE} onChange={p => { setPage(p); load(p) }} />
          </>
        )}
      </Card>
    </div>
  )
}