import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { playbooksAPI } from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Card, Badge, EmptyState } from '../../components/ui/index.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import {
  FiCpu, FiShield, FiUserX, FiSend, FiCheckCircle,
  FiXCircle, FiClock, FiX
} from 'react-icons/fi'
import { format } from 'date-fns'

const PB_ICONS = {
  blocage_ip: <FiShield />,
  desactivation_compte: <FiUserX />,
  notification_escalade: <FiSend />,
}

export default function PlaybooksPage() {
  const { t } = useTranslation()
  const toast = useToast()

  const [executions, setExecutions] = useState([])
  const [loading,     setLoading]   = useState(true)
  const [confirmExec, setConfirmExec] = useState(null) // exécution en attente CONFIRM
  const [cancelTarget, setCancelTarget] = useState(null)
  const timersRef = useRef({})

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await playbooksAPI.getExecutions({ size: 30 })
      setExecutions(data.items || data || mockExecutions())
    } catch {
      setExecutions(mockExecutions())
    } finally {
      setLoading(false)
    }
  }

  // Données de démo si l'API n'a pas encore d'exécutions
  function mockExecutions() {
    return [
      {
        id: 'pb-1', playbook: 'blocage_ip', mode: 'auto', status: 'termine',
        target: '178.43.12.87', executed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
      {
        id: 'pb-2', playbook: 'desactivation_compte', mode: 'confirm', status: 'en_attente',
        target: 'nina.myers', created_at: new Date().toISOString(),
        confirm_deadline: new Date(Date.now() + 42000).toISOString(),
      },
      {
        id: 'pb-3', playbook: 'notification_escalade', mode: 'auto', status: 'termine',
        target: 'SOC Team', executed_at: new Date(Date.now() - 60000).toISOString(),
        created_at: new Date(Date.now() - 60000).toISOString(),
      },
    ]
  }

  useEffect(() => { load() }, [])

  const handleConfirmExecution = async () => {
    if (!confirmExec) return
    try {
      await playbooksAPI.confirm(confirmExec.id)
      toast.success(t('playbooks.success'))
      setExecutions(prev => prev.map(e =>
        e.id === confirmExec.id ? { ...e, status: 'termine', executed_at: new Date().toISOString() } : e
      ))
    } catch {
      toast.error(t('playbooks.failed'))
    } finally {
      setConfirmExec(null)
    }
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    try {
      await playbooksAPI.cancel(cancelTarget.id)
      toast.warning('Action annulée')
      setExecutions(prev => prev.map(e =>
        e.id === cancelTarget.id ? { ...e, status: 'annule' } : e
      ))
    } catch {
      toast.error(t('common.error'))
    } finally {
      setCancelTarget(null)
    }
  }

  const STATUS_BADGE = {
    en_attente: 'WARNING', en_cours: 'INFO',
    termine: 'success', annule: 'READER', echec: 'CRITICAL',
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('playbooks.title')}</h1>
          <p className="page-subtitle">Orchestration automatisée des réponses SOAR</p>
        </div>
      </div>

      <Card>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            {t('common.loading')}
          </div>
        ) : executions.length === 0 ? (
          <EmptyState icon={<FiCpu size={40} />} title="Aucune exécution de playbook" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {executions.map(exec => (
              <PlaybookExecutionCard
                key={exec.id}
                exec={exec}
                onConfirm={() => setConfirmExec(exec)}
                onCancel={() => setCancelTarget(exec)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Confirmation d'exécution manuelle */}
      <ConfirmDialog
        isOpen={!!confirmExec}
        title={t('playbooks.confirmAction')}
        message={t('playbooks.confirmWarning')}
        confirmLabel={t('common.confirm')}
        type="danger"
        onConfirm={handleConfirmExecution}
        onCancel={() => setConfirmExec(null)}
      />

      {/* Confirmation annulation */}
      <ConfirmDialog
        isOpen={!!cancelTarget}
        title={t('playbooks.cancelAction')}
        message="Annuler cette action automatisée ?"
        confirmLabel={t('common.confirm')}
        type="warning"
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  )
}

// ── Carte d'exécution avec countdown live pour le mode CONFIRM ────────────
function PlaybookExecutionCard({ exec, onConfirm, onCancel }) {
  const { t } = useTranslation()
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (exec.mode !== 'confirm' || exec.status !== 'en_attente' || !exec.confirm_deadline) return
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(exec.confirm_deadline) - Date.now()) / 1000))
      setRemaining(diff)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [exec])

  const isPending = exec.mode === 'confirm' && exec.status === 'en_attente'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 18px',
      background: isPending ? 'rgba(210,153,34,0.05)' : 'var(--bg-tertiary)',
      border: `1px solid ${isPending ? 'rgba(210,153,34,0.3)' : 'var(--border-color)'}`,
      borderRadius: 10,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'var(--bg-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent-teal)', fontSize: '1.1rem', flexShrink: 0,
      }}>
        {PB_ICONS[exec.playbook] || <FiCpu />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
          {t(`playbooks.${exec.playbook === 'blocage_ip' ? 'blockIP' : exec.playbook === 'desactivation_compte' ? 'disableAccount' : 'escalate'}`)}
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
          {exec.target}
        </div>
      </div>

      <Badge value={exec.mode === 'confirm' ? 'WARNING' : 'INFO'} />
      <Badge value={
        exec.status === 'termine' ? 'success' :
        exec.status === 'echec' ? 'CRITICAL' :
        exec.status === 'annule' ? 'READER' : 'WARNING'
      } />

      {isPending && remaining !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'JetBrains Mono', fontWeight: 700,
            color: remaining < 15 ? 'var(--sev-critical)' : 'var(--sev-warning)',
            fontSize: '0.95rem',
          }}>
            <FiClock size={14} />
            {remaining}s
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>
            <FiX size={13} /> {t('playbooks.cancelAction')}
          </button>
          <button className="btn btn-danger btn-sm" onClick={onConfirm}>
            <FiCheckCircle size={13} /> {t('common.confirm')}
          </button>
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