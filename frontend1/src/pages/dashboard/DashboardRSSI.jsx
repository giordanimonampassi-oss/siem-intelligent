import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { alertsAPI, reportsAPI } from '../../api/index.js'
import { KpiCard, Card, Badge } from '../../components/ui/index.jsx'
import { IncidentsTrendChart, CircleGauge } from '../../components/charts/index.jsx'
import { FiBarChart2, FiCheckCircle, FiAlertTriangle, FiArrowRight, FiDownload } from 'react-icons/fi'

export default function DashboardRSSI() {
  const { t }     = useTranslation()
  const navigate  = useNavigate()
  const [stats,   setStats]   = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    alertsAPI.getStats().then(r => setStats(r.data || {})).finally(() => setLoading(false))
  }, [])

  const complianceItems = [
    { label: 'RGPD', status: 'ok',      detail: 'Conforme — Dernier audit J-12' },
    { label: 'ISO 27001', status: 'warn', detail: '3 points à traiter' },
    { label: `Rétention ${t('common.all')} logs`, status: 'ok', detail: '30 jours — Actif' },
    { label: 'MFA Utilisateurs', status: 'ok', detail: '100% activé' },
  ]

  const topRules = [
    { name: 'Brute Force SSH (T1110)', count: 142, mitre: 'TA0001' },
    { name: 'Exfiltration données (T1041)', count: 67, mitre: 'TA0010' },
    { name: 'Mouvement latéral NTLM', count: 38, mitre: 'TA0008' },
    { name: 'Suppression logs (T1070)', count: 21, mitre: 'TA0005' },
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

      {/* KPIs RSSI */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KpiCard
          label="Incidents cette semaine"
          value={stats.incidents_week || 7}
          color="high" trend="down"
          sub="−23% vs semaine précédente"
        />
        <KpiCard
          label={t('dashboard.detectionRate')}
          value="94%"
          color="success"
          sub="Taux de détection MITRE"
        />
        <KpiCard
          label={t('dashboard.avgResponseTime')}
          value="8.3s"
          color="teal"
          sub="Objectif : < 30s ✓"
        />
        <KpiCard
          label="Alertes actives"
          value={stats.total_active || 19}
          color="critical"
          sub={`${stats.critical_active || 3} critiques`}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Tendance incidents */}
        <Card title="Évolution des incidents — 30 jours">
          <IncidentsTrendChart />
        </Card>

        {/* Taux détection gauge */}
        <Card title={t('dashboard.detectionRate')}>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', paddingTop: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <CircleGauge value={94} size={110} color="var(--sev-success)" />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>Taux global</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <CircleGauge value={78} size={110} color="var(--sev-warning)" />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>Couverture MITRE</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <CircleGauge value={61} size={110} color="var(--sev-high)" />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>UEBA actif</p>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Conformité */}
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

        {/* Top règles déclenchées */}
        <Card
          title="Top règles déclenchées cette semaine"
          actions={
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/reports')}>
              {t('common.viewAll')} <FiArrowRight size={13} />
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topRules.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700,
                  color: 'var(--text-muted)',
                  width: 18, flexShrink: 0,
                }}>#{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.82rem', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{r.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.mitre}</div>
                </div>
                <div style={{
                  fontSize: '0.85rem', fontWeight: 700,
                  color: i === 0 ? 'var(--sev-critical)' : 'var(--text-secondary)',
                }}>{r.count}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}