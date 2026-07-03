import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useLogs } from '../../hooks/useLogs.js'
import { useToast } from '../../context/ToastContext.jsx'
import {
  Card, Badge, EmptyState, Pagination, SidePanel
} from '../../components/ui/index.jsx'
import {
  FiSearch, FiFilter, FiDownload, FiList, FiClock,
  FiFlag, FiX, FiAlertTriangle
} from 'react-icons/fi'
import { format } from 'date-fns'

const LOG_TYPES = ['', 'AUTH', 'NETWORK', 'APPLICATION', 'SYSTEM', 'CLOUD']
const SEVERITIES = ['', 'INFO', 'WARNING', 'HIGH', 'CRITICAL']

export default function LogsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const location = useLocation()
  const { results, total, loading, search, flag } = useLogs()

  const [keyword, setKeyword]   = useState(location.state?.pivot || '')
  const [filters, setFilters]   = useState({
    source_ip: location.state?.pivot || '',
    username: '', host: '', log_type: '', severity: '',
    from_dt: '', to_dt: '',
  })
  const [showFilters, setShowFilters] = useState(false)
  const [view, setView]         = useState('table') // table | timeline
  const [page, setPage]         = useState(1)
  const [selectedLog, setSelectedLog] = useState(null)
  const [noteText, setNoteText] = useState('')

  const SIZE = 50

  const doSearch = (p = 1) => {
    setPage(p)
    const params = { page: p, size: SIZE }
    if (keyword) params.keyword = keyword
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v })
    search(params)
  }

  useEffect(() => { doSearch(1) }, [])

  const handleFlag = async () => {
    if (!selectedLog) return
    try {
      await flag(selectedLog.id, !selectedLog.is_suspicious, noteText)
      toast.success(t('logs.markSuspicious'))
      setSelectedLog(prev => ({ ...prev, is_suspicious: !prev.is_suspicious, note: noteText }))
    } catch {
      toast.error(t('common.error'))
    }
  }

  const exportCSV = () => {
    const header = 'timestamp,source_ip,host,log_type,severity,raw_message\n'
    const rows = results.map(l =>
      `"${l.timestamp}","${l.source_ip || ''}","${l.host || ''}","${l.log_type}","${l.severity}","${(l.raw_message || '').replace(/"/g, '""')}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `smart_siem_logs_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Export CSV téléchargé')
  }

  const pivotOn = (field, value) => {
    setFilters(f => ({ ...f, [field]: value }))
    setSelectedLog(null)
    setTimeout(() => doSearch(1), 0)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('logs.title')}</h1>
          <p className="page-subtitle">
            {total.toLocaleString()} {t('logs.results')} · {t('logs.engine')}: {keyword ? t('logs.elasticsearch') : t('logs.postgresql')}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={results.length === 0}>
            <FiDownload size={14} /> {t('logs.exportCSV')}
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="input-group" style={{ flex: 1 }}>
            <FiSearch className="input-icon" />
            <input
              className="input"
              placeholder={t('logs.searchPlaceholder')}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch(1)}
            />
          </div>
          <button className="btn btn-secondary" onClick={() => setShowFilters(v => !v)}>
            <FiFilter size={14} /> {t('logs.advancedFilters')}
          </button>
          <button className="btn btn-primary" onClick={() => doSearch(1)}>
            {t('common.search')}
          </button>
        </div>

        {/* Filtres avancés */}
        {showFilters && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12, marginTop: 16, paddingTop: 16,
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <div>
              <label className="form-label">{t('logs.sourceIP')}</label>
              <input className="input" value={filters.source_ip}
                onChange={e => setFilters(f => ({ ...f, source_ip: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">{t('logs.username')}</label>
              <input className="input" value={filters.username}
                onChange={e => setFilters(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">{t('logs.host')}</label>
              <input className="input" value={filters.host}
                onChange={e => setFilters(f => ({ ...f, host: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">{t('logs.logType')}</label>
              <select className="select" value={filters.log_type}
                onChange={e => setFilters(f => ({ ...f, log_type: e.target.value }))}>
                {LOG_TYPES.map(lt => (
                  <option key={lt} value={lt}>{lt ? t(`logs.logTypes.${lt}`) : t('common.all')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">{t('common.severity')}</label>
              <select className="select" value={filters.severity}
                onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}>
                {SEVERITIES.map(s => (
                  <option key={s} value={s}>{s || t('common.all')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">{t('logs.dateFrom')}</label>
              <input className="input" type="datetime-local" value={filters.from_dt}
                onChange={e => setFilters(f => ({ ...f, from_dt: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">{t('logs.dateTo')}</label>
              <input className="input" type="datetime-local" value={filters.to_dt}
                onChange={e => setFilters(f => ({ ...f, to_dt: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-ghost"
                onClick={() => {
                  setFilters({ source_ip:'', username:'', host:'', log_type:'', severity:'', from_dt:'', to_dt:'' })
                  setKeyword('')
                }}>
                <FiX size={14} /> {t('common.reset')}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Toggle vue */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setView('table')}
        >
          <FiList size={14} /> {t('logs.tableView')}
        </button>
        <button
          className={`btn btn-sm ${view === 'timeline' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setView('timeline')}
        >
          <FiClock size={14} /> {t('logs.timelineView')}
        </button>
      </div>

      {/* Résultats */}
      <Card>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            {t('common.loading')}
          </div>
        ) : results.length === 0 ? (
          <EmptyState icon={<FiSearch size={40} />} title={t('logs.noResults')} />
        ) : view === 'table' ? (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('common.severity')}</th>
                    <th>{t('common.type')}</th>
                    <th>{t('logs.sourceIP')}</th>
                    <th>{t('logs.host')}</th>
                    <th>{t('logs.rawMessage')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(log => (
                    <tr key={log.id}
                      onClick={() => { setSelectedLog(log); setNoteText(log.note || '') }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {log.timestamp ? format(new Date(log.timestamp), 'dd/MM HH:mm:ss') : '—'}
                      </td>
                      <td><Badge value={log.severity} /></td>
                      <td><Badge value={log.log_type} /></td>
                      <td>
                        <code
                          style={{ fontSize: '0.78rem', color: 'var(--accent-teal)', cursor: 'pointer' }}
                          onClick={e => { e.stopPropagation(); pivotOn('source_ip', log.source_ip) }}
                        >
                          {log.source_ip || '—'}
                        </code>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{log.host || '—'}</td>
                      <td style={{
                        fontSize: '0.78rem', fontFamily: 'JetBrains Mono',
                        maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: 'var(--text-secondary)',
                      }}>
                        {log.raw_message}
                      </td>
                      <td>
                        {log.is_suspicious && (
                          <FiAlertTriangle size={14} color="var(--sev-warning)" title={t('logs.suspicious')} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={total} size={SIZE} onChange={doSearch} />
          </>
        ) : (
          // Vue Timeline
          <div style={{ position: 'relative', paddingLeft: 24 }}>
            <div style={{
              position: 'absolute', left: 6, top: 0, bottom: 0,
              width: 2, background: 'var(--border-color)',
            }} />
            {results.map(log => {
              const COLOR = {
                CRITICAL: 'var(--sev-critical)', HIGH: 'var(--sev-high)',
                WARNING: 'var(--sev-warning)', INFO: 'var(--sev-info)',
              }
              return (
                <div key={log.id} style={{ position: 'relative', marginBottom: 18, cursor: 'pointer' }}
                  onClick={() => { setSelectedLog(log); setNoteText(log.note || '') }}>
                  <div style={{
                    position: 'absolute', left: -24, top: 4,
                    width: 12, height: 12, borderRadius: '50%',
                    background: COLOR[log.severity] || 'var(--text-muted)',
                    border: '3px solid var(--bg-secondary)',
                    boxShadow: `0 0 0 1px ${COLOR[log.severity] || 'var(--border-color)'}`,
                  }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }}>
                      {log.timestamp ? format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss') : '—'}
                    </span>
                    <Badge value={log.severity} />
                    <Badge value={log.log_type} />
                  </div>
                  <div style={{
                    fontSize: '0.82rem', color: 'var(--text-secondary)',
                    background: 'var(--bg-tertiary)', padding: '8px 12px',
                    borderRadius: 8, fontFamily: 'JetBrains Mono',
                  }}>
                    {log.raw_message}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Panel détail log */}
      <SidePanel
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={t('logs.title')}
      >
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge value={selectedLog.severity} />
              <Badge value={selectedLog.log_type} />
            </div>

            <div style={{
              background: 'var(--bg-tertiary)', padding: 12, borderRadius: 8,
              fontFamily: 'JetBrains Mono', fontSize: '0.8rem', wordBreak: 'break-word',
            }}>
              {selectedLog.raw_message}
            </div>

            {[
              ['Timestamp', selectedLog.timestamp ? format(new Date(selectedLog.timestamp), 'dd/MM/yyyy HH:mm:ss') : '—'],
              [t('logs.sourceIP'), selectedLog.source_ip],
              [t('logs.destIP'), selectedLog.dest_ip],
              [t('logs.host'), selectedLog.host],
              [t('logs.username'), selectedLog.username],
              [t('logs.agentId'), selectedLog.agent_id],
              [t('logs.batchId'), selectedLog.batch_id],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontFamily: 'JetBrains Mono' }}>{value}</span>
              </div>
            ))}

            <div className="form-group">
              <label className="form-label">{t('logs.note')}</label>
              <textarea className="textarea" rows={3}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Ajouter une note d'investigation…" />
            </div>

            <button
              className={`btn ${selectedLog.is_suspicious ? 'btn-danger' : 'btn-secondary'}`}
              onClick={handleFlag}
            >
              <FiFlag size={14} />
              {selectedLog.is_suspicious ? 'Retirer le marquage' : t('logs.markSuspicious')}
            </button>

            {selectedLog.source_ip && (
              <button className="btn btn-ghost"
                onClick={() => pivotOn('source_ip', selectedLog.source_ip)}>
                <FiSearch size={14} /> {t('logs.pivotOn')} {selectedLog.source_ip}
              </button>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  )
}