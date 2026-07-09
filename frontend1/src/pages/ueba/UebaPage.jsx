import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { uebaAPI } from '../../api/index.js'
import { Card, EmptyState } from '../../components/ui/index.jsx'
import { CircleGauge, UEBAScoreChart } from '../../components/charts/index.jsx'
import { FiSearch, FiActivity, FiClock, FiDatabase, FiAlertTriangle } from 'react-icons/fi'
import { format } from 'date-fns'

// ── Helper partagé : extrait un tableau quel que soit le format de réponse ──
// Le backend renvoie { total, results: [...] }. On tolère aussi { items } ou
// un tableau brut, et on ne renvoie jamais autre chose qu'un vrai tableau.
function extractList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.items)) return payload.items
  return null
}

function riskLevel(score) {
  if (score >= 75) return { key: 'critical', color: 'var(--sev-critical)' }
  if (score >= 50) return { key: 'high',     color: 'var(--sev-high)' }
  if (score >= 25) return { key: 'medium',   color: 'var(--sev-warning)' }
  return { key: 'low', color: 'var(--sev-success)' }
}

export default function UEBAPage() {
  const { t } = useTranslation()
  const [search,   setSearch]   = useState('')
  const [profiles, setProfiles] = useState([])
  const [selected, setSelected] = useState(null)
  const [anomalies, setAnomalies] = useState([])
  const [loading,  setLoading]  = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await uebaAPI.listProfiles()
      const items = extractList(data)
      const finalItems = items ?? mockProfiles()
      setProfiles(finalItems)
      if (finalItems.length > 0) selectProfile(finalItems[0])
    } catch {
      const items = mockProfiles()
      setProfiles(items)
      selectProfile(items[0])
    } finally { setLoading(false) }
  }

  function mockProfiles() {
    return [
      { entity_id: 'nina.myers', entity_type: 'user', risk_score: 78, avg_data_volume: 1240000, typical_hours: { '08':40,'09':80,'10':70,'14':60,'15':50 } },
      { entity_id: 'jack.bauer', entity_type: 'user', risk_score: 12, avg_data_volume: 320000, typical_hours: { '06':50,'07':70,'18':40 } },
      { entity_id: 'server-ctu-01', entity_type: 'machine', risk_score: 35, avg_data_volume: 5400000, typical_hours: {} },
    ]
  }

  const selectProfile = async (profile) => {
    setSelected(profile)
    try {
      const { data } = await uebaAPI.getAnomalies(profile.entity_id)
      const items = extractList(data)
      setAnomalies(items ?? mockAnomalies())
    } catch {
      setAnomalies(mockAnomalies())
    }
  }

  function mockAnomalies() {
    return [
      { id: 1, anomaly_type: 'time_anomaly', description: 'Connexion à 02:47 — hors horaires habituels', score_delta: 15, detected_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 2, anomaly_type: 'volume_anomaly', description: '840 fichiers téléchargés en 12 minutes', score_delta: 35, detected_at: new Date(Date.now() - 1800000).toISOString() },
      { id: 3, anomaly_type: 'resource_anomaly', description: 'Accès à une partition chiffrée hors périmètre', score_delta: 31, detected_at: new Date(Date.now() - 600000).toISOString() },
    ]
  }

  useEffect(() => { load() }, [])

  const filtered = Array.isArray(profiles)
    ? profiles.filter(p => p?.entity_id?.toLowerCase().includes(search.toLowerCase()))
    : []

  const risk = selected ? riskLevel(selected.risk_score) : null

  const ANOMALY_ICON = {
    time_anomaly: <FiClock />,
    volume_anomaly: <FiDatabase />,
    resource_anomaly: <FiActivity />,
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('ueba.title')}</h1>
          <p className="page-subtitle">Analyse comportementale — détection d'anomalies</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        {/* Liste entités */}
        <Card>
          <div className="input-group" style={{ marginBottom: 14 }}>
            <FiSearch className="input-icon" />
            <input className="input" placeholder={t('ueba.searchEntity')}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
              {t('common.loading')}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<FiActivity size={30} />} title="Aucun profil" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(p => {
                const r = riskLevel(p.risk_score)
                return (
                  <div key={p.entity_id}
                    onClick={() => selectProfile(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      background: selected?.entity_id === p.entity_id ? 'var(--bg-hover)' : 'transparent',
                      border: `1px solid ${selected?.entity_id === p.entity_id ? 'var(--accent-teal)' : 'transparent'}`,
                    }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: r.color, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.entity_id}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {p.entity_type === 'user' ? 'Utilisateur' : 'Machine'}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: r.color }}>
                      {p.risk_score}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Détail entité */}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header profil + gauge */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <CircleGauge value={Math.round(selected.risk_score)} size={100} color={risk.color} />
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selected.entity_id}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 8 }}>
                    {selected.entity_type === 'user' ? 'Utilisateur' : 'Machine'}
                  </p>
                  <span style={{
                    display: 'inline-block', padding: '4px 10px', borderRadius: 'var(--radius-full)',
                    background: `${risk.color}22`, color: risk.color,
                    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                  }}>
                    {t(`ueba.riskLevel.${risk.key}`)}
                  </span>
                </div>
                {selected.risk_score >= 75 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', background: 'rgba(248,81,73,0.1)',
                    border: '1px solid rgba(248,81,73,0.3)', borderRadius: 8,
                    color: 'var(--sev-critical)', fontSize: '0.8rem', fontWeight: 600,
                  }}>
                    <FiAlertTriangle /> {t('dashboard.anomalyDetected')}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  {t('ueba.scoreHistory')}
                </div>
                <UEBAScoreChart entityId={selected.entity_id} />
              </div>
            </Card>

            {/* Baseline + anomalies */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card title={t('ueba.baseline')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Row label={t('ueba.avgDataVolume')}
                    value={`${((selected.avg_data_volume || 0) / 1024 / 1024).toFixed(1)} MB`} />
                  <Row label={t('ueba.typicalHours')}
                    value={Object.keys(selected.typical_hours || {}).map(h => `${h}h`).join(', ') || '—'} />
                </div>
              </Card>

              <Card title={t('ueba.anomalies')}>
                {!Array.isArray(anomalies) || anomalies.length === 0 ? (
                  <EmptyState title="Aucune anomalie" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {anomalies.map(a => (
                      <div key={a.id} style={{
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 8,
                      }}>
                        <span style={{ color: 'var(--sev-warning)', marginTop: 2 }}>
                          {ANOMALY_ICON[a.anomaly_type] || <FiActivity />}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.8rem' }}>{a.description}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {a.detected_at ? format(new Date(a.detected_at), 'dd/MM HH:mm') : ''}
                            </span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--sev-critical)' }}>
                              +{a.score_delta} pts
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  )
}