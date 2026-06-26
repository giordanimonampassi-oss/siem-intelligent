import { useState, useCallback } from 'react'
import { useLogs } from '../hooks/useLogs'

const SEVERITY_OPTIONS = ['CRITICAL', 'HIGH', 'WARNING', 'INFO']
const TYPE_OPTIONS     = ['AUTH', 'NETWORK', 'SYSTEM', 'APPLICATION', 'CLOUD']

function severityClass(s) {
  const m = { CRITICAL: 'sev-critical', HIGH: 'sev-high', WARNING: 'sev-warning', INFO: 'sev-info' }
  return m[s?.toUpperCase()] || 'sev-info'
}

export function LogSearch({ onNavigate }) {
  const { results, total, loading, error, search, flag } = useLogs()

  const [view, setView]         = useState('table') // 'table' | 'timeline'
  const [keyword, setKeyword]   = useState('')
  const [srcIp, setSrcIp]       = useState('')
  const [username, setUsername] = useState('')
  const [host, setHost]         = useState('')
  const [logType, setLogType]   = useState('')
  const [severity, setSeverity] = useState('')
  const [fromDt, setFromDt]     = useState('')
  const [toDt, setToDt]         = useState('')
  const [engine, setEngine]     = useState('es')
  const [page, setPage]         = useState(1)
  const [selectedLog, setSelectedLog] = useState(null)
  const [flagNote, setFlagNote]       = useState('')
  const [flagging, setFlagging]       = useState(false)

  const buildParams = useCallback((p = 1) => {
    const params = { page: p, size: 50, engine }
    if (keyword)  params.keyword   = keyword
    if (srcIp)    params.source_ip = srcIp
    if (username) params.username  = username
    if (host)     params.host      = host
    if (logType)  params.log_type  = logType
    if (severity) params.severity  = severity
    if (fromDt)   params.from_dt   = new Date(fromDt).toISOString()
    if (toDt)     params.to_dt     = new Date(toDt).toISOString()
    return params
  }, [keyword, srcIp, username, host, logType, severity, fromDt, toDt, engine])

  async function handleSearch(e) {
    e?.preventDefault()
    setPage(1)
    await search(buildParams(1))
  }

  async function handlePage(p) {
    setPage(p)
    await search(buildParams(p))
  }

  function pivotIP(ip) {
    setSrcIp(ip)
    setKeyword('')
    search({ source_ip: ip, page: 1, size: 50, engine })
  }

  async function handleFlag() {
    if (!selectedLog) return
    setFlagging(true)
    try {
      await flag(selectedLog.id, !selectedLog.is_suspicious, flagNote)
      setSelectedLog(prev => ({ ...prev, is_suspicious: !prev.is_suspicious, note: flagNote }))
    } finally {
      setFlagging(false)
    }
  }

  function exportCSV() {
    const header = 'timestamp,source_ip,host,log_type,severity,raw_message\n'
    const rows   = results.map(r =>
      [r.timestamp, r.source_ip || '', r.host || '', r.log_type, r.severity,
       `"${(r.raw_message || '').replace(/"/g, '""')}"`].join(',')
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'logs.csv' })
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.max(1, Math.ceil(total / 50))

  return (
    <section className="page investigation-layout">
      <div className="logs-area">

        {/* Barre de recherche */}
        <form onSubmit={handleSearch}>
          <div className="search-command">
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Rechercher logs, IP, utilisateur, hôte, hash ou requête..."
            />
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? <i className="bi bi-arrow-repeat spin"></i> : 'Rechercher'}
            </button>
            <button type="button" className="secondary-button" onClick={exportCSV}>
              Exporter CSV
            </button>
            <select value={engine} onChange={e => setEngine(e.target.value)}
              title="Moteur de recherche" style={{ fontSize: 11 }}>
              <option value="es">Elasticsearch</option>
              <option value="pg">PostgreSQL</option>
            </select>
          </div>
        </form>

        {/* Filtres avancés */}
        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text2)',
            padding: '8px 12px', background: 'var(--card)',
            border: '1px solid var(--border)', borderRadius: 6 }}>
            Filtres avancés
          </summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
            gap: 10, padding: 14, background: 'var(--card)',
            border: '1px solid var(--border)', borderTop: 'none',
            borderRadius: '0 0 8px 8px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text2)' }}>
              IP source
              <input value={srcIp} onChange={e => setSrcIp(e.target.value)} placeholder="178.43.12.87" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text2)' }}>
              Utilisateur
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="nmyers" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text2)' }}>
              Hôte
              <input value={host} onChange={e => setHost(e.target.value)} placeholder="ctu-srv-01" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text2)' }}>
              Type de log
              <select value={logType} onChange={e => setLogType(e.target.value)}>
                <option value="">Tous</option>
                {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text2)' }}>
              Sévérité
              <select value={severity} onChange={e => setSeverity(e.target.value)}>
                <option value="">Toutes</option>
                {SEVERITY_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text2)' }}>
                Depuis
                <input type="datetime-local" value={fromDt} onChange={e => setFromDt(e.target.value)} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text2)' }}>
                Jusqu'à
                <input type="datetime-local" value={toDt} onChange={e => setToDt(e.target.value)} />
              </label>
            </div>
          </div>
        </details>

        {/* Méta-résultats */}
        {total > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
            <strong style={{ color: 'var(--text1)' }}>{total.toLocaleString()}</strong> résultats
            {keyword && <> pour <em>"{keyword}"</em></>}
          </div>
        )}

        {error && (
          <div className="auth-error" style={{ marginBottom: 10 }}>
            <i className="bi bi-exclamation-triangle-fill"></i> {error}
          </div>
        )}

        {/* Toggle vue */}
        <div className="view-toggle" style={{ marginBottom: 12 }}>
          <button className={`view-btn${view === 'table' ? ' active' : ''}`} onClick={() => setView('table')}>
            Vue tableau
          </button>
          <button className={`view-btn${view === 'timeline' ? ' active' : ''}`} onClick={() => setView('timeline')}>
            Vue timeline
          </button>
        </div>

        {/* Tableau */}
        {view === 'table' && (
          <section className="panel log-table">
            <div className="table-row table-head">
              <span>Horodatage</span>
              <span>Source IP</span>
              <span>Hôte</span>
              <span>Type</span>
              <span>Sévérité</span>
              <span>Message</span>
              <span>Actions</span>
            </div>

            {loading && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text2)' }}>
                <i className="bi bi-arrow-repeat spin"></i> Chargement…
              </div>
            )}

            {!loading && results.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text2)' }}>
                Aucun résultat — lancez une recherche
              </div>
            )}

            {results.map(log => (
              <div
                className="table-row"
                key={log.id}
                style={log.is_suspicious ? { background: 'rgba(248,81,73,.06)' } : {}}
              >
                <span className="mono" style={{ fontSize: 11 }}>
                  {new Date(log.timestamp).toLocaleString('fr-FR')}
                </span>
                <span>
                  {log.source_ip
                    ? <button className="ip-link" onClick={() => pivotIP(log.source_ip)}>{log.source_ip}</button>
                    : <span style={{ color: 'var(--text2)' }}>—</span>
                  }
                </span>
                <span style={{ fontSize: 11 }}>{log.host || '—'}</span>
                <span>
                  <span className="sev-badge sev-info" style={{ fontSize: 9 }}>{log.log_type}</span>
                </span>
                <span>
                  <span className={`sev-badge ${severityClass(log.severity)}`}>{log.severity}</span>
                </span>
                <span className="mono" style={{ fontSize: 10, maxWidth: 220,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.is_suspicious && <i className="bi bi-flag-fill" style={{ color: 'var(--critical)', marginRight: 4 }}></i>}
                  {log.raw_message}
                </span>
                <span style={{ whiteSpace: 'nowrap', display: 'flex', gap: 4 }}>
                  <button className="btn btn-sm" onClick={() => { setSelectedLog(log); setFlagNote(log.note || '') }}>
                    Détails
                  </button>
                  {log.source_ip && (
                    <button className="btn btn-sm" onClick={() => pivotIP(log.source_ip)}>
                      Pivot →
                    </button>
                  )}
                </span>
              </div>
            ))}
          </section>
        )}

        {/* Timeline */}
        {view === 'timeline' && (
          <section className="panel" style={{ padding: 20 }}>
            <div style={{ position: 'relative', overflowX: 'auto', padding: '40px 0' }}>
              <div style={{ height: 2, background: 'var(--border)', position: 'relative', margin: '30px 20px' }}>
                {results.map((log, i) => {
                  const colors = { CRITICAL: '#F85149', HIGH: '#E3A325', WARNING: '#D29922', INFO: '#58A6FF' }
                  const left = `${(i / Math.max(results.length - 1, 1)) * 90 + 5}%`
                  return (
                    <div key={log.id} style={{ position: 'absolute', left, transform: 'translateX(-50%)', cursor: 'pointer' }}
                      onClick={() => setSelectedLog(log)}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%',
                        background: colors[log.severity] || '#58A6FF',
                        border: '2px solid var(--bg)', transform: 'translateY(-5px)' }} />
                      <div style={{ fontSize: 9, color: 'var(--text2)', textAlign: 'center',
                        marginTop: 8, whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleTimeString('fr-FR')}<br />
                        {log.severity}
                      </div>
                    </div>
                  )
                })}
              </div>
              {results.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text2)', marginTop: 20 }}>
                  Lancez une recherche pour afficher la timeline
                </div>
              )}
            </div>
          </section>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
            <button className="btn btn-sm" onClick={() => handlePage(Math.max(1, page - 1))} disabled={page === 1}>← Préc</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`btn btn-sm${p === page ? ' btn-primary' : ''}`} onClick={() => handlePage(p)}>{p}</button>
            ))}
            <button className="btn btn-sm" onClick={() => handlePage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Suiv →</button>
          </div>
        )}
      </div>

      {/* Panneau latéral détail */}
      {selectedLog && (
        <aside className="detail-drawer" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="drawer-head">
            <div>
              <h2>Détail de l'événement</h2>
              <code style={{ fontSize: 10 }}>ID: {selectedLog.id?.slice(0, 8)}…</code>
            </div>
            <button type="button" className="icon-button" onClick={() => setSelectedLog(null)}>
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </div>

          <div className="risk-box">
            <span>Sévérité</span>
            <strong><span className={`sev-badge ${severityClass(selectedLog.severity)}`}>{selectedLog.severity}</span></strong>
          </div>

          {[
            ['Type',       selectedLog.log_type],
            ['Source IP',  selectedLog.source_ip || '—'],
            ['Dest IP',    selectedLog.dest_ip   || '—'],
            ['Hôte',       selectedLog.host      || '—'],
            ['Utilisateur',selectedLog.username  || '—'],
            ['Batch ID',   selectedLog.batch_id  || '—'],
            ['Horodatage', new Date(selectedLog.timestamp).toLocaleString('fr-FR')],
          ].map(([label, val]) => (
            <div key={label} style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--text2)', fontSize: 10, textTransform: 'uppercase',
                letterSpacing: '.5px', display: 'block', marginBottom: 2 }}>{label}</span>
              <span className="mono">{val}</span>
            </div>
          ))}

          <h3 style={{ fontSize: 12, marginTop: 4 }}>Message brut</h3>
          <pre style={{ fontSize: 10, lineHeight: 1.6, wordBreak: 'break-all',
            background: 'var(--bg)', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}>
            {selectedLog.raw_message}
          </pre>

          <label className="switch-row">
            {selectedLog.is_suspicious ? '🚩 Marqué comme suspect' : 'Marquer comme suspect'}
            <input type="checkbox" checked={selectedLog.is_suspicious} onChange={handleFlag} />
          </label>

          <textarea
            value={flagNote}
            onChange={e => setFlagNote(e.target.value)}
            placeholder="Note d'investigation…"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text1)', padding: 8, fontSize: 12,
              resize: 'vertical', height: 70 }}
          />

          <button
            className="primary-button full-width"
            onClick={handleFlag}
            disabled={flagging}
          >
            {flagging ? 'Mise à jour…' : 'Sauvegarder la note'}
          </button>

          {selectedLog.source_ip && (
            <button
              className="secondary-button full-width"
              onClick={() => { pivotIP(selectedLog.source_ip); setSelectedLog(null) }}
            >
              Pivot sur {selectedLog.source_ip}
            </button>
          )}
        </aside>
      )}
    </section>
  )
}