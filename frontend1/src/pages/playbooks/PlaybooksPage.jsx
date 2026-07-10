import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { playbooksAPI } from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Card, Badge, EmptyState, SidePanel } from '../../components/ui/index.jsx'
import Modal from '../../components/ui/Modal.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import {
  FiCpu, FiShield, FiUserX, FiSend, FiCheckCircle,
  FiXCircle, FiClock, FiX, FiPlus, FiTrash2
} from 'react-icons/fi'
import { format } from 'date-fns'

const PB_ICONS = {
  blocage_ip: <FiShield />,
  desactivation_compte: <FiUserX />,
  notification_escalade: <FiSend />,
  block_ip: <FiShield />,
  disable_account: <FiUserX />,
  escalate: <FiSend />,
}

const PLAYBOOK_MAP = { block_ip: 'blocage_ip', disable_account: 'desactivation_compte', escalate: 'notification_escalade' }
const STATUS_MAP   = { pending: 'en_attente', running: 'en_cours', completed: 'termine', failed: 'echec', cancelled: 'annule' }

function normalizeExecution(e) {
  return { ...e, playbook: PLAYBOOK_MAP[e.playbook] || e.playbook, status: STATUS_MAP[e.status] || e.status }
}
function extractList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.items)) return payload.items
  return null
}

const ACTION_OPTIONS  = ['block_ip', 'disable_account', 'escalate']
const CHANNEL_OPTIONS = ['firewall', 'ldap', 'webhook', 'email']
const SEVERITY_OPTIONS = ['', 'INFO', 'WARNING', 'HIGH', 'CRITICAL']

export default function PlaybooksPage() {
  const { t } = useTranslation()
  const toast = useToast()

  const [executions, setExecutions] = useState([])
  const [catalog,    setCatalog]    = useState([])
  const [loading,     setLoading]   = useState(true)
  const [confirmExec, setConfirmExec] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Creation
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', mode: 'auto', max_delay_sec: 60,
    severity_filter: '', actions: [], channels: [], is_active: true,
  })

  // Detail
  const [selectedPlaybook, setSelectedPlaybook] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [execRes, catRes] = await Promise.all([
        playbooksAPI.getExecutions({ size: 30 }).catch(() => ({ data: mockExecutions() })),
        playbooksAPI.listCatalog().catch(() => ({ data: [] })),
      ])
      const execItems = extractList(execRes.data) ?? mockExecutions()
      setExecutions(execItems.map(normalizeExecution))
      setCatalog(extractList(catRes.data) ?? [])
    } finally {
      setLoading(false)
    }
  }

const handleDeletePlaybook = async () => {
  if (!deleteTarget) return
  try {
    await playbooksAPI.delete(deleteTarget.id)
    toast.success('Playbook supprimé')
    setSelectedPlaybook(null)
    setDetail(null)
    setDeleteTarget(null)
    load()
  } catch (err) {
    toast.error(err.response?.data?.detail || t('common.error'))
  }
}

  function mockExecutions() {
    return [
      { id: 'pb-1', playbook: 'block_ip', mode: 'auto', status: 'completed', target: '178.43.12.87', executed_at: new Date().toISOString(), created_at: new Date().toISOString() },
      { id: 'pb-2', playbook: 'disable_account', mode: 'confirm', status: 'pending', target: 'nina.myers', created_at: new Date().toISOString(), confirm_deadline: new Date(Date.now() + 42000).toISOString() },
      { id: 'pb-3', playbook: 'escalate', mode: 'auto', status: 'completed', target: 'SOC Team', executed_at: new Date(Date.now() - 60000).toISOString(), created_at: new Date(Date.now() - 60000).toISOString() },
    ]
  }

  useEffect(() => { load() }, [])

  const handleConfirmExecution = async () => {
    if (!confirmExec) return
    try {
      await playbooksAPI.confirm(confirmExec.id)
      toast.success(t('playbooks.success'))
      setExecutions(prev => prev.map(e => e.id === confirmExec.id ? { ...e, status: 'termine', executed_at: new Date().toISOString() } : e))
    } catch { toast.error(t('playbooks.failed')) }
    finally { setConfirmExec(null) }
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    try {
      await playbooksAPI.cancel(cancelTarget.id)
      toast.warning('Action annulée')
      setExecutions(prev => prev.map(e => e.id === cancelTarget.id ? { ...e, status: 'annule' } : e))
    } catch { toast.error(t('common.error')) }
    finally { setCancelTarget(null) }
  }

  // ── Creation playbook ────────────────────────────────────────────────
  const toggleArrayField = (field, value) => {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter(v => v !== value) : [...f[field], value],
    }))
  }

  const handleCreate = async () => {
    try {
      const payload = { ...form, severity_filter: form.severity_filter || null }
      await playbooksAPI.create(payload)
      toast.success('Playbook créé')
      setCreateOpen(false)
      setForm({ name: '', description: '', mode: 'auto', max_delay_sec: 60, severity_filter: '', actions: [], channels: [], is_active: true })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'))
    }
  }

  // ── Detail playbook ──────────────────────────────────────────────────
  const openDetail = async (pb) => {
    setSelectedPlaybook(pb)
    setDetailLoading(true)
    try {
      const { data } = await playbooksAPI.getDetail(pb.id)
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('playbooks.title')}</h1>
          <p className="page-subtitle">Orchestration automatisée des réponses SOAR</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
          <FiPlus size={14} /> Nouveau playbook
        </button>
      </div>

      {/* Catalogue */}
      <Card title="Playbooks configurés" style={{ marginBottom: 16 }}>
        {catalog.length === 0 ? (
          <EmptyState icon={<FiCpu size={32} />} title="Aucun playbook configuré" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {catalog.map(pb => (
              <div key={pb.id}
                onClick={() => openDetail(pb)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px', background: 'var(--bg-tertiary)',
                  borderRadius: 8, cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: 'var(--bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-teal)',
                }}>
                  <FiCpu size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>{pb.name}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {pb.mode} · {pb.severity_filter || 'toutes sévérités'}
                  </div>
                </div>
                <Badge value={pb.is_active ? 'success' : 'READER'} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Executions recentes */}
      <Card title="Exécutions récentes">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}</div>
        ) : executions.length === 0 ? (
          <EmptyState icon={<FiCpu size={40} />} title="Aucune exécution de playbook" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {executions.map(exec => (
              <PlaybookExecutionCard key={exec.id} exec={exec}
                onConfirm={() => setConfirmExec(exec)} onCancel={() => setCancelTarget(exec)} />
            ))}
          </div>
        )}
      </Card>

      {/* Modal creation */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouveau playbook"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={!form.name}>Créer</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Nom</label>
          <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Mode</label>
          <select className="select" value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}>
            <option value="auto">Automatique</option>
            <option value="confirm">Confirmation (délai)</option>
            <option value="manual">Manuel</option>
          </select>
        </div>
        {form.mode === 'confirm' && (
          <div className="form-group">
            <label className="form-label">Délai de confirmation (secondes)</label>
            <input className="input" type="number" min={5} value={form.max_delay_sec}
              onChange={e => setForm(f => ({ ...f, max_delay_sec: Number(e.target.value) }))} />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Sévérité déclenchante</label>
          <select className="select" value={form.severity_filter} onChange={e => setForm(f => ({ ...f, severity_filter: e.target.value }))}>
            {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s || 'Toutes'}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Actions</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ACTION_OPTIONS.map(a => (
              <button key={a} type="button"
                className={`btn btn-sm ${form.actions.includes(a) ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => toggleArrayField('actions', a)}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Canaux de notification</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CHANNEL_OPTIONS.map(c => (
              <button key={c} type="button"
                className={`btn btn-sm ${form.channels.includes(c) ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => toggleArrayField('channels', c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Detail playbook */}
      <SidePanel isOpen={!!selectedPlaybook} onClose={() => { setSelectedPlaybook(null); setDetail(null) }} title={selectedPlaybook?.name || 'Détail playbook'}>
        {detailLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}</div>
        ) : detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge value={detail.is_active ? 'success' : 'READER'} />
              <Badge value={detail.mode === 'confirm' ? 'WARNING' : 'INFO'} />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{detail.description || 'Aucune description'}</p>
            <div style={{ fontSize: '0.8rem' }}>
              <div><strong>Sévérité :</strong> {detail.severity_filter || 'toutes'}</div>
              <div><strong>Délai confirmation :</strong> {detail.max_delay_sec}s</div>
              <div><strong>Actions :</strong> {(detail.actions || []).join(', ') || '—'}</div>
              <div><strong>Canaux :</strong> {(detail.channels || []).join(', ') || '—'}</div>
            </div>
            <div>
              <h4 style={{ fontSize: '0.85rem', marginBottom: 8 }}>Dernières exécutions</h4>
              {(detail.recent_executions || []).length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Aucune exécution encore</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detail.recent_executions.map(e => (
                    <div key={e.id} style={{ fontSize: '0.75rem', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                      {e.target} — {e.status} — {e.executed_at ? format(new Date(e.executed_at), 'dd/MM HH:mm') : '—'}
                    </div>
                  ))}
                </div>
              )}
              <button className="btn btn-danger" onClick={() => setDeleteTarget(selectedPlaybook)}>
                <FiTrash2 size={14} /> Supprimer ce playbook
              </button>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Impossible de charger le détail.</p>
        )}
      </SidePanel>

      <ConfirmDialog isOpen={!!confirmExec} title={t('playbooks.confirmAction')} message={t('playbooks.confirmWarning')}
        confirmLabel={t('common.confirm')} type="danger" onConfirm={handleConfirmExecution} onCancel={() => setConfirmExec(null)} />
      <ConfirmDialog isOpen={!!cancelTarget} title={t('playbooks.cancelAction')} message="Annuler cette action automatisée ?"
        confirmLabel={t('common.confirm')} type="warning" onConfirm={handleCancel} onCancel={() => setCancelTarget(null)} />
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Supprimer ce playbook ?"
        message={deleteTarget ? `"${deleteTarget.name}" sera definitivement supprime.` : ''}
        type="danger"
        confirmLabel="Supprimer"
        onConfirm={handleDeletePlaybook}
        onCancel={() => setDeleteTarget(null)}
/>
    </div>
  )
}

function PlaybookExecutionCard({ exec, onConfirm, onCancel }) {
  const { t } = useTranslation()
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (exec.mode !== 'confirm' || exec.status !== 'en_attente' || !exec.confirm_deadline) return
    const tick = () => setRemaining(Math.max(0, Math.floor((new Date(exec.confirm_deadline) - Date.now()) / 1000)))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [exec])

  const isPending = exec.mode === 'confirm' && exec.status === 'en_attente'
  const labelKey = exec.playbook === 'blocage_ip' ? 'blockIP' : exec.playbook === 'desactivation_compte' ? 'disableAccount' : 'escalate'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px',
      background: isPending ? 'rgba(210,153,34,0.05)' : 'var(--bg-tertiary)',
      border: `1px solid ${isPending ? 'rgba(210,153,34,0.3)' : 'var(--border-color)'}`, borderRadius: 10,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-teal)' }}>
        {PB_ICONS[exec.playbook] || <FiCpu />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{t(`playbooks.${labelKey}`)}</div>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>{exec.target}</div>
      </div>
      <Badge value={exec.mode === 'confirm' ? 'WARNING' : 'INFO'} />
      <Badge value={exec.status === 'termine' ? 'success' : exec.status === 'echec' ? 'CRITICAL' : exec.status === 'annule' ? 'READER' : exec.status === 'en_cours' ? 'INFO' : 'WARNING'} />
      {isPending && remaining !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'JetBrains Mono', fontWeight: 700, color: remaining < 15 ? 'var(--sev-critical)' : 'var(--sev-warning)', fontSize: '0.95rem' }}>
            <FiClock size={14} />{remaining}s
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onCancel}><FiX size={13} /> {t('playbooks.cancelAction')}</button>
          <button className="btn btn-danger btn-sm" onClick={onConfirm}><FiCheckCircle size={13} /> {t('common.confirm')}</button>
        </div>
      )}
      {exec.status === 'termine' && (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {exec.executed_at ? format(new Date(exec.executed_at), 'HH:mm:ss') : ''}
        </span>
      )}
    </div>
  )
}