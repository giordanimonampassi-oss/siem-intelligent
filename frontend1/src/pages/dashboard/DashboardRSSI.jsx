import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { alertsAPI } from '../../api/index.js'
import { KpiCard, Card, Badge } from '../../components/ui/index.jsx'
import { IncidentsTrendChart, CircleGauge } from '../../components/charts/index.jsx'
import { FiBarChart2, FiCheckCircle, FiAlertTriangle, FiArrowRight } from 'react-icons/fi'

function extractList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.items)) return payload.items
  return null
}

function formatSeconds(s) {
  if (s == null) return '—'
  if (s < 60) return `${s.toFixed(1)}s`
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}

export default function DashboardRSSI() {
  const { t }     = useTranslation()
  const navigate  = useNavigate()
  const [stats,    setStats]    = useState({})
  const [metrics,  setMetrics]  = useState({})
  const [topRules, setTopRules] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([
      alertsAPI.getStats().catch(() => ({ data: {} })),
      alertsAPI.getRSSIMetrics(7).catch(() => ({ data: {} })),
      alertsAPI.getTopRules(7, 5).catch(() => ({ data: [] })),
    ]).then(([sRes, mRes, rRes]) => {
      setStats(sRes.data || {})
      setMetrics(mRes.data || {})
      setTopRules(extractList(rRes.data) ?? [])
    }).finally(() => setLoading(false))
  }, [])

  const totalActive    = (stats.by_status?.NEW || 0) + (stats.by_status?.ACKNOWLEDGED || 0)
  const criticalActive = stats.by_severity?.CRITICAL || 0
  const totalAllTime    = stats.total || 0

  // Conformite : aucun module ne calcule ceci aujourd'hui (pas de moteur
  // d'audit RGPD/ISO en base) — reste volontairement statique/illustratif.
  const complianceItems = [
    { label: 'RGPD', status: 'ok',      detail: 'Conforme — Dernier audit J-12' },
    { label: 'ISO 27001', status: 'warn', detail: '3 points à traiter' },
    { label: 'Rétention logs', status: 'ok', detail: '30 jours — Actif' },
    { label: 'MFA Utilisateurs', status: 'ok', detail: '100% activé' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('dashboard.synthesisView')}</h1>
          <p className="page-subtitle">Vue synthétique — RSSI</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/reports')}>
          <FiBarChart2 size={14} /> {t('reports.generate')}
        </button>
      </div>

      {/* KPIs — tous reellement calcules cote backend */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KpiCard
          label="Alertes actives"
          value={totalActive}
          color="critical"
          sub={`${criticalActive} critiques`}
        />
        <KpiCard
          label="Alertes déclenchées (total)"
          value={totalAllTime}
          color="teal"
          sub="Depuis la mise en service"
        />
        <KpiCard
          label="Temps de réponse moyen"
          value={formatSeconds(metrics.avg_response_seconds)}
          color="teal"
          sub="Déclenchement → acquittement (7 derniers jours)"
        />
        <KpiCard
          label="Confiance moyenne des alertes"
          value={metrics.avg_confidence != null ? `${Math.round(metrics.avg_confidence * 100)}%` : '—'}
          color="success"
          sub="Score de confiance des règles (7 derniers jours)"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Tendance incidents — pas d'endpoint "incidents par jour" encore construit */}
        <Card title="Évolution des incidents — 30 jours (exemple)">
          <IncidentsTrendChart />
        </Card>

        {/* Gauges — desormais reelles pour MITRE et UEBA */}
        <Card title="Couverture de détection">
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', paddingTop: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <CircleGauge value={Math.round(metrics.mitre_coverage_pct ?? 0)} size={110} color="var(--sev-warning)" />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>
                Couverture MITRE (règles actives)
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <CircleGauge value={Math.round(metrics.ueba_coverage_pct ?? 0)} size={110} color="var(--sev-high)" />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>
                Entités avec baseline UEBA
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Conformité — reste statique, pas de module d'audit reglementaire en base */}
        <Card title={<><FiCheckCircle size={14} /> {t('dashboard.complianceStatus')}</>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {complianceItems.map(item => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                background: item.status === 'ok'
                  ? 'rgba(63,185,80,0.05)' : 'rgba(210,153,34,0.05)',
                border: `1px solid ${item.status === 'ok'
                  ? 'rgba(63,185,80,0.2)' : 'rgba(210,153,34,0.3)'}`,
                borderRadius: 8,
              }}>
                {item.status === 'ok'
                  ? <FiCheckCircle color="var(--sev-success)" />
                  : <FiAlertTriangle color="var(--sev-warning)" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.detail}</div>
                </div>
                <Badge value={item.status === 'ok' ? 'success' : 'WARNING'} />
              </div>
            ))}
          </div>
        </Card>

        {/* Top règles — desormais un vrai GROUP BY sur Alert.rule_id */}
        <Card
          title="Top règles déclenchées — 7 derniers jours"
          actions={
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/reports')}>
              {t('common.viewAll')} <FiArrowRight size={13} />
            </button>
          }
        >
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
              {t('common.loading')}
            </div>
          ) : topRules.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Aucune règle déclenchée sur cette période
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topRules.map((r, i) => (
                <div key={r.rule_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    color: 'var(--text-muted)', width: 18, flexShrink: 0,
                  }}>#{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.82rem', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{r.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {r.mitre_tactic || 'N/A'} {r.mitre_technique ? `· ${r.mitre_technique}` : ''}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '0.85rem', fontWeight: 700,
                    color: i === 0 ? 'var(--sev-critical)' : 'var(--text-secondary)',
                  }}>{r.count}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}