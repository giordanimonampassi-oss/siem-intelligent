import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { getDashboardMetrics, getLiveFeed } from '../api/dashboard'

// ── Utilitaires ───────────────────────────────────────────────────────────────
function severityClass(s) {
  const m = { CRITICAL: 'sev-critical', HIGH: 'sev-high', WARNING: 'sev-warning', INFO: 'sev-info' }
  return m[s] || 'sev-info'
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)   return `il y a ${s}s`
  if (s < 3600) return `il y a ${Math.floor(s / 60)}min`
  return `il y a ${Math.floor(s / 3600)}h`
}

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ width = '100%', height = 20, style = {} }) {
  return (
    <div style={{
      width, height,
      background: 'linear-gradient(90deg, var(--card) 25%, rgba(255,255,255,.04) 50%, var(--card) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      borderRadius: 4,
      ...style,
    }} />
  )
}

// ── Mini graphique barres inline ──────────────────────────────────────────────
function MiniBarChart({ data = [], color = 'var(--teal)', height = 48 }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height }}>
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max(4, (v / max) * 100)}%`,
            background: color,
            borderRadius: '2px 2px 0 0',
            opacity: 0.7 + (i / data.length) * 0.3,
            transition: 'height 0.4s ease',
          }}
        />
      ))}
    </div>
  )
}

// ── Donut SVG ─────────────────────────────────────────────────────────────────
function DonutChart({ segments = [] }) {
  const total = segments.reduce((s, g) => s + g.value, 0) || 1
  let offset = 0
  const r = 45, cx = 50, cy = 50
  const circ = 2 * Math.PI * r

  return (
    <div className="donut-row">
      <svg width="110" height="110" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
        {segments.map((seg, i) => {
          const pct   = seg.value / total
          const dash  = pct * circ
          const gap   = circ - dash
          const el = (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="10"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset * circ}
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          )
          offset += pct
          return el
        })}
        <circle cx={cx} cy={cy} r="32" fill="var(--card)" />
      </svg>
      <ul className="legend">
        {segments.map(seg => (
          <li key={seg.label}>
            <span className="dot" style={{ background: seg.color, borderRadius: 2 }}></span>
            {seg.label} {Math.round((seg.value / total) * 100)}%
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Compteur anime ────────────────────────────────────────────────────────────
function AnimatedNumber({ value, duration = 600 }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    if (value === 0 || value == null) { setDisplay(0); return }
    const start = Date.now()
    const from  = display
    const tick  = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (value - from) * ease))
      if (progress < 1) ref.current = requestAnimationFrame(tick)
    }
    ref.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(ref.current)
  }, [value])

  return <span>{display.toLocaleString('fr-FR')}</span>
}

// ── Vues du dashboard ─────────────────────────────────────────────────────────
const VIEWS = [
  { id: 'analyste',     label: 'Analyste' },
  { id: 'rssi',         label: 'RSSI' },
  { id: 'realtime',     label: 'Temps reel' },
  { id: 'investigation',label: 'Investigation' },
]

// ── MetricCards ───────────────────────────────────────────────────────────────
function MetricCards({ metrics, loading }) {
  if (loading) {
    return (
      <div className="metric-grid">
        {[0, 1, 2, 3].map(i => (
          <article className="metric-card info" key={i}>
            <Skeleton height={12} width="60%" />
            <Skeleton height={32} width="40%" style={{ marginTop: 8 }} />
            <Skeleton height={10} width="80%" style={{ marginTop: 6 }} />
          </article>
        ))}
      </div>
    )
  }

  const cards = [
    {
      label:   'Alertes critiques',
      value:   metrics.critical,
      caption: 'Actives en ce moment',
      tone:    'critical',
    },
    {
      label:   'Alertes elevees',
      value:   metrics.high,
      caption: 'Surveillance accrue',
      tone:    'warning',
    },
    {
      label:   'Logs / heure',
      value:   metrics.total,
      caption: '60 dernières minutes',
      tone:    'info',
    },
    {
      label:   'Sources actives',
      value:   metrics.topIps?.length || 0,
      caption: 'IP sources uniques',
      tone:    'info',
    },
  ]

  return (
    <div className="metric-grid">
      {cards.map(card => (
        <article className={`metric-card ${card.tone}`} key={card.label}
          style={{ animation: 'fadeIn 0.3s ease' }}>
          <span>{card.label}</span>
          <strong style={{ fontSize: 28 }}>
            <AnimatedNumber value={card.value || 0} />
          </strong>
          <small>{card.caption}</small>
        </article>
      ))}
    </div>
  )
}

// ── Log Volume Chart ──────────────────────────────────────────────────────────
function LogVolumeChart({ logs = [], loading }) {
  // Groupe par heure
  const hourBuckets = Array(24).fill(0)
  const critBuckets = Array(24).fill(0)
  logs.forEach(l => {
    if (!l.timestamp) return
    const h = new Date(l.timestamp).getHours()
    hourBuckets[h]++
    if (l.severity === 'CRITICAL') critBuckets[h]++
  })

  return (
    <section className="panel chart-panel wide">
      <div className="panel-header">
        <h2>Volume de logs sur 24h</h2>
        <span style={{ fontSize: 11, color: 'var(--text2)' }}>
          Total / evenements critiques
        </span>
      </div>
      {loading ? (
        <Skeleton height={80} />
      ) : (
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 4 }}>Total</div>
            <MiniBarChart data={hourBuckets} color="var(--teal)" height={64} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 4 }}>Critiques</div>
            <MiniBarChart data={critBuckets} color="var(--critical)" height={64} />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text2)' }}>
          <div style={{ width: 8, height: 8, background: 'var(--teal)', borderRadius: 2 }}></div>
          Logs totaux
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text2)' }}>
          <div style={{ width: 8, height: 8, background: 'var(--critical)', borderRadius: 2 }}></div>
          Critiques
        </div>
      </div>
    </section>
  )
}

// ── Distribution par type ─────────────────────────────────────────────────────
function AlertDistribution({ byType = {}, loading }) {
  const COLORS = {
    AUTH:        'var(--info)',
    NETWORK:     'var(--teal)',
    SYSTEM:      'var(--warning)',
    APPLICATION: 'var(--critical)',
    CLOUD:       '#a78bfa',
  }
  const LABELS = {
    AUTH:        'Authentification',
    NETWORK:     'Reseau',
    SYSTEM:      'Systeme',
    APPLICATION: 'Application',
    CLOUD:       'Cloud',
  }

  const segments = Object.entries(byType)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ label: LABELS[k] || k, value: v, color: COLORS[k] || '#888' }))

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Repartition des alertes</h2>
      </div>
      {loading ? (
        <Skeleton height={100} />
      ) : segments.length > 0 ? (
        <DonutChart segments={segments} />
      ) : (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text2)', fontSize: 12 }}>
          Aucune donnee — lancez une ingestion
        </div>
      )}
    </section>
  )
}

// ── Latest Alerts ─────────────────────────────────────────────────────────────
function LatestAlertsPanel({ logs = [], loading, onNavigate }) {
  return (
    <section className="panel latest-alerts">
      <div className="panel-header">
        <h2>Derniers evenements</h2>
        <button type="button" className="text-button" onClick={() => onNavigate?.('logs')}>
          Voir tous les enregistrements
        </button>
      </div>
      <div className="table">
        <div className="table-row table-head">
          <span>Severite</span>
          <span>Type</span>
          <span>Source IP</span>
          <span>Horodatage</span>
          <span>Hote</span>
        </div>
        {loading && [0,1,2,3,4].map(i => (
          <div className="table-row" key={i} style={{ gap: 8 }}>
            <Skeleton height={18} width={60} />
            <Skeleton height={18} width={70} />
            <Skeleton height={18} width={100} />
            <Skeleton height={18} width={80} />
            <Skeleton height={18} width={90} />
          </div>
        ))}
        {!loading && logs.length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text2)', fontSize: 12 }}>
            Aucun evenement — ingestion de logs en attente
          </div>
        )}
        {!loading && logs.map(log => (
          <div
            className="table-row"
            key={log.id}
            style={{
              animation: 'fadeIn 0.2s ease',
              background: log.severity === 'CRITICAL' ? 'rgba(248,81,73,.05)' : undefined,
            }}
          >
            <span className={`badge ${severityClass(log.severity)}`}>
              {log.severity}
            </span>
            <span style={{ fontSize: 11 }}>{log.log_type}</span>
            <code style={{ fontSize: 11 }}>{log.source_ip || '—'}</code>
            <span style={{ fontSize: 11 }}>{timeAgo(log.timestamp)}</span>
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>{log.host || '—'}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Top Source IPs ────────────────────────────────────────────────────────────
function TopSourceIps({ topIps = [], loading }) {
  const max = topIps[0]?.count || 1

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Principales IP sources</h2>
        {topIps.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text2)' }}>{topIps.length} sources</span>
        )}
      </div>
      {loading && [0,1,2,3].map(i => (
        <div className="bar-row" key={i} style={{ marginBottom: 8 }}>
          <Skeleton height={14} width={120} />
          <Skeleton height={8} width="60%" style={{ marginTop: 4 }} />
        </div>
      ))}
      {!loading && topIps.length === 0 && (
        <div style={{ padding: '12px 0', color: 'var(--text2)', fontSize: 12 }}>
          Aucune source detectee
        </div>
      )}
      {!loading && topIps.map((item, i) => (
        <div className="bar-row" key={item.ip}
          style={{ animation: `fadeIn ${0.1 + i * 0.05}s ease` }}>
          <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.ip}</span>
          <div>
            <i style={{
              width: `${Math.max(4, (item.count / max) * 100)}%`,
              transition: 'width 0.5s ease',
            }}></i>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 8, minWidth: 20 }}>
            {item.count}
          </span>
        </div>
      ))}
    </section>
  )
}

// ── Executive Summary RSSI ────────────────────────────────────────────────────
function ExecutiveSummary({ metrics, loading }) {
  const kv = [
    ['Logs analyses',       metrics.total || 0],
    ['Evenements critiques',metrics.critical || 0],
    ['Evenements eleves',   metrics.high || 0],
    ['Sources actives',     metrics.topIps?.length || 0],
  ]

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Synthese RSSI</h2>
        <span style={{ fontSize: 11, color: 'var(--text2)' }}>Donnees en temps reel</span>
      </div>
      <div className="profile-kv">
        {kv.map(([label, val]) => (
          <>
            <span key={label + '_k'}>{label}</span>
            <strong key={label + '_v'}>
              {loading ? <Skeleton height={14} width={40} /> : <AnimatedNumber value={val} />}
            </strong>
          </>
        ))}
      </div>
    </section>
  )
}

// ── Live Feed ─────────────────────────────────────────────────────────────────
function LiveFeed({ feed = [], loading }) {
  const SEV_COLOR = { CRITICAL: 'var(--critical)', HIGH: 'var(--high)', WARNING: 'var(--warning)', INFO: 'var(--teal)' }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Flux temps reel</h2>
        <span className="live-indicator">En direct</span>
      </div>
      {loading ? (
        <ol className="timeline">
          {[0,1,2].map(i => <li key={i}><Skeleton height={14} /></li>)}
        </ol>
      ) : (
        <ol className="timeline">
          {feed.length === 0 && (
            <li style={{ color: 'var(--text2)', fontSize: 12 }}>
              En attente d'evenements...
            </li>
          )}
          {feed.slice(0, 6).map(log => (
            <li key={log.id} style={{ animation: 'fadeIn 0.3s ease' }}>
              <span style={{ color: SEV_COLOR[log.severity] || 'var(--text2)' }}>
                {formatTime(log.timestamp)}
              </span>
              <span style={{ fontSize: 11 }}>
                [{log.severity}] {log.log_type} — {log.source_ip || log.host || 'interne'}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export function Dashboard({ onNavigate }) {
  const { user } = useAuth()
  const [activeView, setActiveView] = useState('analyste')
  const [metrics, setMetrics]       = useState({
    total: 0, critical: 0, high: 0, warning: 0,
    byType: {}, topIps: [], logs: [],
  })
  const [feed, setFeed]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const intervalRef = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      const [metricsData, feedData] = await Promise.all([
        getDashboardMetrics(),
        getLiveFeed(8),
      ])
      setMetrics(metricsData)
      setFeed(feedData)
      setLastUpdate(new Date())
    } catch {
      // Silencieux — garde les donnees precedentes
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 30_000)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  const rssiCards = [
    {
      label:   'Alertes critiques',
      value:   metrics.critical > 0 ? String(metrics.critical) : '0',
      caption: metrics.critical > 0 ? 'Niveau de risque : eleve' : 'Aucune alerte critique',
      tone:    metrics.critical > 0 ? 'critical' : 'info',
    },
    {
      label:   'Logs analyses',
      value:   metrics.total > 0 ? String(metrics.total) : '0',
      caption: 'Derniere heure',
      tone:    'warning',
    },
    {
      label:   'Sources actives',
      value:   String(metrics.topIps?.length || 0),
      caption: 'IP sources uniques',
      tone:    'info',
    },
  ]

  return (
    <section className="page page-dashboard">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      <div className="dashboard-toolbar">
        <div>
          <h1>Tableau de bord</h1>
          <p style={{ color: 'var(--text2)', fontSize: 12, margin: 0 }}>
            {lastUpdate
              ? `Mis a jour le ${lastUpdate.toLocaleTimeString('fr-FR')}`
              : 'Chargement...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="secondary-button"
            style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={fetchData}
          >
            <i className="bi bi-arrow-clockwise"></i> Actualiser
          </button>
          <div className="segmented dashboard-views" role="tablist">
            {VIEWS.map(view => (
              <button
                type="button"
                key={view.id}
                role="tab"
                aria-selected={activeView === view.id}
                className={activeView === view.id ? 'active' : ''}
                onClick={() => setActiveView(view.id)}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vue Analyste */}
      {activeView === 'analyste' && (
        <>
          <MetricCards metrics={metrics} loading={loading} />
          <div className="dashboard-grid">
            <LogVolumeChart logs={metrics.logs || []} loading={loading} />
            <AlertDistribution byType={metrics.byType} loading={loading} />
            <LatestAlertsPanel logs={metrics.logs || []} loading={loading} onNavigate={onNavigate} />
            <TopSourceIps topIps={metrics.topIps || []} loading={loading} />
          </div>
        </>
      )}

      {/* Vue RSSI */}
      {activeView === 'rssi' && (
        <>
          <div className="metric-grid">
            {rssiCards.map(card => (
              <article className={`metric-card ${card.tone}`} key={card.label}
                style={{ animation: 'fadeIn 0.3s ease' }}>
                <span>{card.label}</span>
                <strong style={{ fontSize: 28 }}>{card.value}</strong>
                <small>{card.caption}</small>
              </article>
            ))}
          </div>
          <div className="dashboard-grid compact">
            <ExecutiveSummary metrics={metrics} loading={loading} />
            <AlertDistribution byType={metrics.byType} loading={loading} />
          </div>
        </>
      )}

      {/* Vue Temps reel */}
      {activeView === 'realtime' && (
        <>
          <MetricCards metrics={metrics} loading={loading} />
          <div className="dashboard-grid">
            <LiveFeed feed={feed} loading={loading} />
            <LatestAlertsPanel logs={metrics.logs || []} loading={loading} onNavigate={onNavigate} />
          </div>
        </>
      )}

      {/* Vue Investigation */}
      {activeView === 'investigation' && (
        <>
          <div className="metric-grid">
            {[
              { label: 'Critiques', value: metrics.critical, tone: 'critical' },
              { label: 'Eleves',    value: metrics.high,     tone: 'warning' },
            ].map(c => (
              <article className={`metric-card ${c.tone}`} key={c.label}
                style={{ animation: 'fadeIn 0.3s ease' }}>
                <span>{c.label}</span>
                <strong style={{ fontSize: 28 }}>
                  <AnimatedNumber value={c.value || 0} />
                </strong>
                <small>Requierent une investigation</small>
              </article>
            ))}
          </div>
          <div className="dashboard-grid">
            <LatestAlertsPanel logs={metrics.logs || []} loading={loading} onNavigate={onNavigate} />
            <TopSourceIps topIps={metrics.topIps || []} loading={loading} />
            <LogVolumeChart logs={metrics.logs || []} loading={loading} />
          </div>
        </>
      )}
    </section>
  )
}