import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { alertsAPI } from '../../api/index.js'
import { getLogsStats } from '../../api/logs.js'
import { KpiCard, Card, Badge } from '../../components/ui/index.jsx'
import LogVolumeChart from '../../components/charts/LogVolumeChart.jsx'
import { AlertsDonutChart, TopIPsChart } from '../../components/charts/index.jsx'
import {
  FiAlertCircle, FiAlertTriangle, FiActivity,
  FiLayers, FiRefreshCw, FiArrowRight
} from 'react-icons/fi'
import { formatDistanceToNow } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

export default function DashboardAnalyst() {
  const { t, i18n } = useTranslation()
  const navigate    = useNavigate()
  const locale      = i18n.language === 'fr' ? fr : enUS

  const [stats,   setStats]   = useState({})
  const [alerts,  setAlerts]  = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpd, setLastUpd] = useState(null)

const load = async () => {                    // ← async ici
    try {
      setLoading(true)
      const [logStats, alertsRes] = await Promise.all([
        getLogsStats(),                                      // ← Appel backend
        alertsAPI.list({ size: 8, sort: '-created_at' }).catch(() => ({ data: { results: [] } })),
      ])
      setStats(logStats)
      // Le backend renvoie { total, page, size, results } — pas "items".
      // Garde défensive : si la forme change encore, on retombe sur [] au
      // lieu de faire planter tout le composant.
      const list = alertsRes.data?.results
      setAlerts(Array.isArray(list) ? list : [])
      setLastUpd(new Date())
    } catch (err) {
      console.error("Erreur chargement dashboard:", err)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const critCount = alerts.filter(a => a.severity === 'CRITICAL' && a.status === 'NEW').length
  const highCount = alerts.filter(a => a.severity === 'HIGH'     && a.status === 'NEW').length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('dashboard.title')}</h1>
          <p className="page-subtitle">
            {lastUpd && `${t('dashboard.lastUpdated')} ${formatDistanceToNow(lastUpd, { addSuffix: true, locale })}`}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={load}>
            <FiRefreshCw size={14} /> {t('common.refresh')}
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => navigate('/crisis')}>
            🔴 {t('dashboard.crisisRoom')}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KpiCard
          label={t('dashboard.criticalAlerts')} value={critCount}
          color="critical" icon={<FiAlertCircle />}
          trend={critCount > 0 ? 'up' : undefined}
          sub={critCount > 0 ? 'Nécessitent action immédiate' : 'Aucune alerte critique'}
        />
        <KpiCard
          label={t('dashboard.highAlerts')} value={highCount}
          color="high" icon={<FiAlertTriangle />}
          sub="Alertes niveau élevé actives"
        />
        <KpiCard
          label={t('dashboard.logsPerHour')}
          value={(stats.logs_last_hour || 0).toLocaleString()}
          color="teal" icon={<FiActivity />}
          sub="Dernière heure"
        />
        <KpiCard
          label={t('dashboard.openIncidents')}
          value={stats.open_incidents || 0}
          color="info" icon={<FiLayers />}
          sub="En cours de traitement"
        />
      </div>

      {/* Graphes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, marginBottom: 16 }}>
        <Card
          title={<><FiActivity size={15} /> {t('dashboard.logVolume')}</>}
          actions={
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/logs')}>
              {t('common.viewAll')} <FiArrowRight size={13} />
            </button>
          }
        >
          <LogVolumeChart data={stats.hourly_volume || []} />
        </Card>

        <Card title={t('dashboard.alertsByType')}>
          <AlertsDonutChart data={
            Object.entries(stats.by_type || {}).map(([name, value]) => ({ name, value }))
          } />
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        {/* Dernières alertes */}
        <Card
          title={<><FiAlertCircle size={15} /> {t('dashboard.latestAlerts')}</>}
          actions={
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/alerts')}>
              {t('common.viewAll')} <FiArrowRight size={13} />
            </button>
          }
        >
          {loading ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              {t('common.loading')}
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>{t('common.severity')}</th>
                    <th>Titre</th>
                    <th>{t('alerts.sourceIP')}</th>
                    <th>Heure</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.length === 0 ? (
                    <tr><td colSpan={5} className="table-empty">{t('alerts.noAlerts')}</td></tr>
                  ) : alerts.map(a => (
                    <tr key={a.id} style={{
                      borderLeft: a.severity === 'CRITICAL' ? '3px solid var(--sev-critical)' : undefined,
                    }}>
                      <td><Badge value={a.severity} pulse={a.severity === 'CRITICAL'} /></td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.title || a.alert_id}
                      </td>
                      <td>
                        <code style={{ fontSize: '0.78rem', color: 'var(--accent-teal)' }}>
                          {a.source_ip || '—'}
                        </code>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {a.triggered_at
                          ? formatDistanceToNow(new Date(a.triggered_at), { addSuffix: true, locale })
                          : '—'}
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => navigate('/alerts', { state: { selectedId: a.id } })}>
                          {t('alerts.investigate')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
       </Card>

        {/* Top IPs */}
        <Card title={t('dashboard.topSourceIPs')}>
          <TopIPsChart data={
            (stats.top_source_ips || []).map(i => ({ ip: i.ip, count: i.count }))
          } />
        </Card>
      </div>
    </div>
  )
}