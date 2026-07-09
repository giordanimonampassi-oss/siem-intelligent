 import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { alertsAPI, playbooksAPI, firewallAPI } from '../../api/index.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useModal } from '../../hooks/useAlerts.js'
import {
  Badge, Card, SidePanel, EmptyState, Pagination
} from '../../components/ui/index.jsx'
import Modal from '../../components/ui/Modal.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import {
  FiAlertCircle, FiFilter, FiRefreshCw, FiSearch,
  FiEye, FiCheck, FiCheckCircle, FiCpu, FiX, FiShieldOff, FiAlertTriangle
} from 'react-icons/fi'
import { formatDistanceToNow, format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

const SEVERITIES = ['', 'CRITICAL', 'HIGH', 'WARNING', 'INFO']
const STATUSES   = ['', 'NEW', 'ACKNOWLEDGED', 'RESOLVED']

export default function AlertsPage() {
  const { t, i18n } = useTranslation()
  const { isAnalyst } = useAuth()
  const toast         = useToast()
  const navigate      = useNavigate()
  const location      = useLocation()
  const locale        = i18n.language === 'fr' ? fr : enUS

  const [alerts,   setAlerts]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [filters,  setFilters]  = useState({ severity: '', status: '', keyword: '' })
  const [showFilters, setShowFilters] = useState(false)

  // Panel détail
  const [selected, setSelected] = useState(null)
  const panelOpen = !!selected

  // Modal playbook
  const pbModal  = useModal()
  const [confirm, setConfirm] = useState(null)

  // ── Blocage IP rapide ──────────────────────────────────────────────────
  const [blockTarget, setBlockTarget] = useState(null)   // { ip } en attente de confirmation
  const [blockingIp,  setBlockingIp]  = useState(null)   // ip en cours de blocage
  const [blockedIps,  setBlockedIps]  = useState(new Set()) // suivi optimiste local

  const SIZE = 20

  const load = async () => {
    setLoading(true)
    try {
      const params = {
        page, size: SIZE,
        ...(filters.severity && { severity: filters.severity }),
        ...(filters.status   && { status:   filters.status }),
      }
      const { data } = await alertsAPI.list(params)
      const items = data.results || []
      setAlerts(items)
      setTotal(data.total || items.length)

      if (location.state?.selectedId) {
        const found = items.find(a => a.id === location.state.selectedId)
        if (found) setSelected(found)
      }
    } catch {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, filters.severity, filters.status])

  const handleAcknowledge = async (id) => {
    try {
      await alertsAPI.acknowledge(id)
      toast.success('Alerte acquittée')
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'ACKNOWLEDGED' } : a))
      if (selected?.id === id) setSelected(prev => ({ ...prev, status: 'ACKNOWLEDGED' }))
    } catch { toast.error(t('common.error')) }
  }

  const handleResolve = async (id) => {
    setConfirm({
      id,
      title: t('alerts.resolve'),
      message: 'Marquer cette alerte comme résolue ?',
      type: 'info',
    })
  }

  const confirmResolve = async () => {
    try {
      await alertsAPI.resolve(confirm.id)
      toast.success('Alerte résolue')
      setAlerts(prev => prev.map(a => a.id === confirm.id ? { ...a, status: 'RESOLVED' } : a))
      if (selected?.id === confirm.id) setSelected(prev => ({ ...prev, status: 'RESOLVED' }))
    } catch { toast.error(t('common.error')) }
    finally { setConfirm(null) }
  }

  // ── Blocage IP : confirmation puis appel API ───────────────────────────
  const handleBlockClick = (ip) => {
    setBlockTarget({ ip })
  }

  const confirmBlock = async () => {
    if (!blockTarget) return
    const { ip } = blockTarget
    setBlockingIp(ip)
    try {
      await firewallAPI.blockIp(ip, 'Blocage manuel depuis la page Alertes')
      toast.success(`IP ${ip} bloquée`)
      setBlockedIps(prev => new Set(prev).add(ip))
    } catch {
      toast.error(t('common.error'))
    } finally {
      setBlockingIp(null)
      setBlockTarget(null)
    }
  }

  const SEV_BORDER = {
    CRITICAL: 'var(--sev-critical)',
    HIGH:     'var(--sev-high)',
    WARNING:  'var(--sev-warning)',
    INFO:     'var(--sev-info)',
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('alerts.liveTitle')}</h1>
          <p className="page-subtitle">{total} alerte(s) trouvée(s)</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowFilters(v => !v)}>
            <FiFilter size={14} /> {t('alerts.filterBySeverity')}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={load}>
            <FiRefreshCw size={14} />
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => navigate('/crisis')}>
            <FiAlertTriangle size={16} />  {t('alerts.crisisRoom')}
          </button>
        </div>
      </div>

      {/* Filtres */}
      {showFilters && (
        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap',
          padding: '16px', marginBottom: 16,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <div style={{ flex: '1 1 160px' }}>
            <label className="form-label">{t('common.severity')}</label>
            <select className="select"
              value={filters.severity}
              onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}>
              {SEVERITIES.map(s => (
                <option key={s} value={s}>{s || t('common.all')}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label className="form-label">{t('common.status')}</label>
            <select className="select"
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              {STATUSES.map(s => (
                <option key={s} value={s}>{s ? t(`alerts.status.${s}`) : t('common.all')}</option>
              ))}
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm"
              onClick={() => { setFilters({ severity: '', status: '', keyword: '' }); setPage(1) }}>
              <FiX size={14} /> {t('common.reset')}
            </button>
          </div>
        </div>
      )}

      {/* Liste alertes */}
      <Card>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            {t('common.loading')}
          </div>
        ) : alerts.length === 0 ? (
          <EmptyState
            icon={<FiAlertCircle size={40} />}
            title={t('alerts.noAlerts')}
            description="Aucune alerte ne correspond aux critères sélectionnés."
          />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {alerts.map(alert => {
                const isBlocked  = alert.source_ip && blockedIps.has(alert.source_ip)
                const isBlocking = blockingIp === alert.source_ip
                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelected(alert)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 20px',
                      borderBottom: '1px solid var(--border-subtle)',
                      borderLeft: `4px solid ${SEV_BORDER[alert.severity] || 'var(--border-color)'}`,
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      background: selected?.id === alert.id ? 'var(--bg-hover)' : undefined,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = selected?.id === alert.id ? 'var(--bg-hover)' : ''}
                  >
                    {/* Sévérité */}
                    <Badge value={alert.severity} pulse={alert.severity === 'CRITICAL' && alert.status === 'NEW'} />

                    {/* Titre + MITRE */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.875rem', fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {alert.title || alert.alert_id || 'Alerte sans titre'}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                        {alert.source_ip && (
                          <code style={{ fontSize: '0.72rem', color: 'var(--accent-teal)' }}>
                            {alert.source_ip}
                          </code>
                        )}
                        {alert.mitre_tactic && (
                          <span style={{
                            fontSize: '0.68rem', color: 'var(--text-muted)',
                            fontFamily: 'JetBrains Mono',
                          }}>
                            {alert.mitre_tactic} · {alert.mitre_technique}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Confiance */}
                    {alert.confidence != null && (
                      <div style={{ textAlign: 'center', minWidth: 52 }}>
                        <div style={{
                          fontSize: '0.9rem', fontWeight: 700,
                          color: alert.confidence > 0.8 ? 'var(--sev-critical)' : 'var(--sev-warning)',
                        }}>
                          {Math.round(alert.confidence * 100)}%
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          {t('alerts.confidence')}
                        </div>
                      </div>
                    )}

                    {/* Heure */}
                    <div style={{
                      fontSize: '0.72rem', color: 'var(--text-muted)',
                      whiteSpace: 'nowrap', minWidth: 80, textAlign: 'right',
                    }}>
                      {alert.created_at
                        ? formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale })
                        : '—'}
                    </div>

                    {/* Statut */}
                    <Badge value={alert.status} />

                    {/* Actions (analyste seulement) */}
                    {isAnalyst && (
                      <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                        {alert.status === 'NEW' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleAcknowledge(alert.id)}
                            title={t('alerts.acknowledge')}
                          >
                            <FiCheck size={13} />
                          </button>
                        )}
                        {alert.source_ip && (
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={isBlocked || isBlocking}
                            onClick={() => handleBlockClick(alert.source_ip)}
                            title={isBlocked ? `${alert.source_ip} déjà bloquée` : `Bloquer ${alert.source_ip}`}
                          >
                            <FiShieldOff size={13} />
                            {isBlocked ? 'Bloquée' : isBlocking ? '…' : 'Bloquer'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <Pagination page={page} total={total} size={SIZE} onChange={setPage} />
          </>
        )}
      </Card>

      {/* Panneau détail */}
      <SidePanel
        isOpen={panelOpen}
        onClose={() => setSelected(null)}
        title={selected?.alert_id || 'Détail alerte'}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge value={selected.severity} />
              <Badge value={selected.status} />
              {selected.mitre_tactic && (
                <span style={{
                  fontSize: '0.72rem', fontFamily: 'JetBrains Mono',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  padding: '2px 8px', borderRadius: 4,
                  color: 'var(--text-secondary)',
                }}>
                  {selected.mitre_tactic} · {selected.mitre_technique}
                </span>
              )}
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 8 }}>
                {selected.title || selected.alert_id}
              </h4>
            </div>

            {/* Champs */}
            {[
              { label: t('alerts.sourceIP'),   value: selected.source_ip,   mono: true },
              { label: t('alerts.targetHost'),  value: selected.target_host },
              { label: 'Utilisateur',           value: selected.username },
              { label: t('alerts.confidence'),  value: selected.confidence != null ? `${Math.round(selected.confidence * 100)}%` : null },
              { label: t('alerts.occurrences'), value: selected.occurrence_count },
              { label: t('alerts.triggeredAt'), value: selected.created_at ? format(new Date(selected.created_at), 'dd/MM/yyyy HH:mm:ss') : null },
            ].filter(f => f.value).map(({ label, value, mono }) => (
              <div key={label} style={{
                display: 'flex', flexDirection: 'column', gap: 3,
                padding: '10px 12px',
                background: 'var(--bg-tertiary)',
                borderRadius: 8,
              }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {label}
                </span>
                <span style={{
                  fontSize: '0.875rem', fontWeight: 500,
                  fontFamily: mono ? 'JetBrains Mono' : undefined,
                  color: mono ? 'var(--accent-teal)' : 'var(--text-primary)',
                }}>
                  {String(value)}
                </span>
              </div>
            ))}

            {/* Actions */}
            {isAnalyst && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {selected.status === 'NEW' && (
                  <button className="btn btn-secondary"
                    onClick={() => handleAcknowledge(selected.id)}>
                    <FiCheck size={14} /> {t('alerts.acknowledge')}
                  </button>
                )}
                {selected.status !== 'RESOLVED' && (
                  <button className="btn btn-primary"
                    onClick={() => handleResolve(selected.id)}>
                    <FiCheckCircle size={14} /> {t('alerts.resolve')}
                  </button>
                )}
                <button className="btn btn-secondary"
                  onClick={() => { pbModal.open(selected); setSelected(null) }}>
                  <FiCpu size={14} /> {t('alerts.runPlaybook')}
                </button>
                {selected.source_ip && (
                  <button
                    className="btn btn-danger"
                    disabled={blockedIps.has(selected.source_ip) || blockingIp === selected.source_ip}
                    onClick={() => handleBlockClick(selected.source_ip)}
                  >
                    <FiShieldOff size={14} />
                    {blockedIps.has(selected.source_ip)
                      ? `${selected.source_ip} déjà bloquée`
                      : `Bloquer ${selected.source_ip}`}
                  </button>
                )}
                <button className="btn btn-ghost"
                  onClick={() => navigate('/logs', { state: { pivot: selected.source_ip } })}>
                  <FiSearch size={14} /> {t('logs.pivotOn')} {selected.source_ip}
                </button>
              </div>
            )}
          </div>
        )}
      </SidePanel>

      {/* Confirm resolve */}
      <ConfirmDialog
        isOpen={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        type="info"
        confirmLabel="Résoudre"
        onConfirm={confirmResolve}
        onCancel={() => setConfirm(null)}
      />

      {/* Confirm blocage IP */}
      <ConfirmDialog
        isOpen={!!blockTarget}
        title="Bloquer cette adresse IP ?"
        message={blockTarget ? `${blockTarget.ip} sera bloquée pendant 60 minutes (blocage applicatif Smart SIEM).` : ''}
        type="danger"
        confirmLabel="Bloquer"
        onConfirm={confirmBlock}
        onCancel={() => setBlockTarget(null)}
      />
    </div>
  )
}