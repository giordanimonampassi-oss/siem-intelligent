import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { alertsAPI, playbooksAPI } from '../../api/index.js'
import { searchLogs } from '../../api/logs.js'
import { FiX, FiCheckCircle, FiLoader, FiAlertTriangle } from 'react-icons/fi'
import { format } from 'date-fns'

const REFRESH_SEC = 5

export default function CrisisRoomPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [data, setData]           = useState({ critical: 0, playbooksRunning: 0, compromised: 0 })
  const [logFeed, setLogFeed]     = useState([])
  const [executions, setExecutions] = useState([])
  const [elapsed, setElapsed]     = useState(0)
  const [countdown, setCountdown] = useState(REFRESH_SEC)
  const startRef  = useRef(Date.now())

  const load = useCallback(async () => {
    try {
      const [statsRes, execRes, criticalRes, logsRes] = await Promise.all([
        alertsAPI.getStats(),
        // PlaybookStatus.RUNNING = "running" (minuscules) côté backend
        playbooksAPI.getExecutions({ size: 6, status: 'running' }).catch(() => ({ data: [] })),
        // Le backend n'expose pas de compteur "systèmes compromis" — on
        // l'approxime par le nombre d'hôtes distincts touchés par des
        // alertes CRITICAL non résolues.
        alertsAPI.list({ severity: 'CRITICAL', status: 'NEW', size: 50 }).catch(() => ({ data: { results: [] } })),
        // Flux d'événements en direct : vrais logs récents, plus de simulation.
        // search_logs_pg/es trient déjà par timestamp DESC côté backend.
        searchLogs({ page: 1, size: 10, engine: 'pg' }).catch(() => ({ results: [] })),
      ])
      const stats = statsRes.data || {}
      const criticalAlerts = criticalRes.data?.results || []
      const compromisedHosts = new Set(
        criticalAlerts.map((a) => a.target_host).filter(Boolean),
      )
      setData({
        critical: stats.by_severity?.CRITICAL || 0,
        playbooksRunning: (execRes.data || []).length,
        compromised: compromisedHosts.size,
      })
      setExecutions(execRes.data || [])

      // LogSeverity backend = info/warning/critical (minuscules, pas de HIGH
      // pour les logs bruts — contrairement aux alertes). On uppercase pour
      // rester cohérent avec SEV_COLOR ci-dessous.
      const logs = logsRes.results || []
      setLogFeed(
        logs.map((log) => ({
          id: log.id,
          time: log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss') : '—',
          sev: (log.severity || 'info').toUpperCase(),
          ip: log.source_ip || '—',
          msg: log.raw_message || `Événement ${log.log_type || ''}`.trim(),
        }))
      )
    } catch { /* silencieux */ }
    setCountdown(REFRESH_SEC)
  }, [])

  // Timer écoulé
  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // Refresh auto toutes les 5s (stats + executions + alertes + logs)
  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_SEC * 1000)
    return () => clearInterval(t)
  }, [load])

  // Countdown visuel
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => c > 0 ? c - 1 : REFRESH_SEC), 1000)
    return () => clearInterval(t)
  }, [])

  const fmtElapsed = () => {
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0')
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
    const s = String(elapsed % 60).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const SEV_COLOR = {
    CRITICAL: 'var(--sev-critical)',
    HIGH: 'var(--sev-high)',
    WARNING: 'var(--sev-warning)',
    INFO: 'var(--sev-info)',
  }

  return (
    <div className="crisis-room">
      {/* Header */}
      <div className="crisis-header">
        <div className="crisis-indicator">
          <span className="crisis-dot" />
          <span className="crisis-title">
            <FiAlertTriangle size={25} /> {t('alerts.activeIncident')} — {data.critical > 0 ? 'CRITICAL' : 'STABLE'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
              {t('alerts.elapsed')}
            </div>
            <div className="crisis-timer">{fmtElapsed()}</div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(-1)}
            style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <FiX size={16} /> {t('alerts.exitCrisisRoom')}
          </button>
        </div>
      </div>

      {/* Corps */}
      <div className="crisis-body" style={{ gridTemplateColumns: '280px 1fr 320px' }}>
        {/* KPIs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="crisis-kpi">
            <div className="crisis-kpi-number red">{data.critical}</div>
            <div className="crisis-kpi-label">Alertes critiques</div>
          </div>
          <div className="crisis-kpi">
            <div className="crisis-kpi-number orange">{data.playbooksRunning}</div>
            <div className="crisis-kpi-label">{t('dashboard.playbooksRunning')}</div>
          </div>
          <div className="crisis-kpi">
            <div className="crisis-kpi-number red" style={{ fontSize: '3rem' }}>
              {data.compromised}
            </div>
            <div className="crisis-kpi-label">{t('alerts.compromised')}</div>
          </div>
        </div>

        {/* Feed temps réel */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: 20, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.06em',
          }}>
            Flux d'événements en direct
          </div>
          <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'JetBrains Mono', fontSize: '0.78rem' }}>
            {logFeed.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
                Aucun événement récent
              </p>
            ) : logFeed.map(entry => (
              <div key={entry.id} style={{
                display: 'flex', gap: 10, padding: '6px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.7)',
              }}>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>{entry.time}</span>
                <span style={{ color: SEV_COLOR[entry.sev] || SEV_COLOR.INFO, fontWeight: 700, minWidth: 60 }}>
                  {entry.sev}
                </span>
                <span style={{ color: 'var(--accent-teal)' }}>{entry.ip}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.msg}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Playbooks en cours */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: 20,
        }}>
          <div style={{
            fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase', marginBottom: 14, letterSpacing: '0.06em',
          }}>
            Playbooks en exécution
          </div>
          {executions.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
              Aucun playbook actif
            </p>
          ) : executions.map(exec => (
            <div key={exec.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <FiLoader className="spin-icon" style={{ color: 'var(--sev-high)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.82rem', color: '#fff' }}>{exec.playbook}</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{exec.target}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="crisis-footer">
        <span>Smart SIEM CTU — Vue Crisis Room</span>
        <span className="refresh-countdown">
          Rafraîchissement dans {countdown}s
        </span>
      </div>
    </div>
  )
}