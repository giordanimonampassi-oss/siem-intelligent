import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { reportsAPI } from '../../api/index.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { Card, EmptyState } from '../../components/ui/index.jsx'
import Modal from '../../components/ui/Modal.jsx'
import {
  FiFileText, FiDownload, FiPlus, FiShield, FiCheckCircle,
  FiXCircle, FiTrendingUp
} from 'react-icons/fi'
import { format } from 'date-fns'

const REPORT_TYPES = [
  { key: 'security',   icon: <FiShield /> },
  { key: 'compliance', icon: <FiCheckCircle /> },
  { key: 'incident',   icon: <FiFileText /> },
  { key: 'audit',      icon: <FiFileText /> },
]
const PERIODS = ['daily', 'weekly', 'monthly', 'custom']

// ── Helper : extrait un tableau quel que soit le format de réponse ──────────
// Le backend renvoie { total, results: [...] }. On garde aussi les anciens
// formats ({ items: [...] } ou tableau brut) par tolérance/rétrocompat.
function extractList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.items)) return payload.items
  return null // signal d'échec explicite -> on saura qu'il faut fallback au mock
}

export default function ReportsPage() {
  const { t }       = useTranslation()
  const { isAnalyst, isRSSI, isAuditor } = useAuth()
  const toast        = useToast()

  const [reports,   setReports]   = useState([])
  const [batches,   setBatches]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [genOpen,   setGenOpen]   = useState(false)
  const [genType,   setGenType]   = useState('security')
  const [genPeriod, setGenPeriod] = useState('weekly')
  const [generating,setGenerating]= useState(false)
  const [downloadingId, setDownloadingId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [rRes, bRes] = await Promise.all([
        reportsAPI.list().catch(() => null),
        reportsAPI.getIntegrityBatches().catch(() => null),
      ])

      const reportList = rRes ? extractList(rRes.data) : null
      const batchList  = bRes ? extractList(bRes.data) : null

      setReports(reportList ?? mockReports())
      setBatches(batchList ?? mockBatches())
    } finally {
      setLoading(false)
    }
  }

  function mockReports() {
    return [
      { id: 1, type: 'security', period: 'weekly', generated_at: new Date().toISOString(), total_logs: 47832, top_threat: 'Brute Force SSH' },
      { id: 2, type: 'compliance', period: 'monthly', generated_at: new Date(Date.now() - 86400000 * 5).toISOString(), total_logs: 198234 },
      { id: 3, type: 'audit', period: 'weekly', generated_at: new Date(Date.now() - 86400000 * 2).toISOString(), total_logs: 12044 },
    ]
  }
  function mockBatches() {
    return [
      { id: 1, period_start: new Date(Date.now() - 3600000).toISOString(), log_count: 4200, sha256_hash: 'a3f8c91d7e2b4f6a8d1c3e5f7a9b2d4c', verified: true },
      { id: 2, period_start: new Date(Date.now() - 7200000).toISOString(), log_count: 3890, sha256_hash: 'b7e2d4f6a8c1e3f5a7d9b2c4e6f8a1d3', verified: true },
      { id: 3, period_start: new Date(Date.now() - 10800000).toISOString(), log_count: 4510, sha256_hash: 'c9f1e3d5b7a9f2e4d6c8a1f3e5b7d9c1', verified: false },
    ]
  }

  useEffect(() => { load() }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await reportsAPI.generate(genType, genPeriod)
      toast.success(t('reports.generate') + ' — OK')
      setGenOpen(false)
      load()
    } catch {
      toast.error(t('common.error'))
    } finally {
      setGenerating(false)
    }
  }

  // ── Téléchargement réel (branché sur GET /reports/{id}/download) ─────────
  const handleDownload = async (report) => {
    setDownloadingId(report.id)
    try {
      const res = await reportsAPI.download(report.id) // responseType: 'blob'
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url  = window.URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `rapport-${report.type}-${report.id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Rapport téléchargé')
    } catch {
      toast.error(t('common.error'))
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('reports.title')}</h1>
          <p className="page-subtitle">Rapports de sécurité, conformité et audit</p>
        </div>
        {(isAnalyst || isRSSI) && (
          <button className="btn btn-primary btn-sm" onClick={() => setGenOpen(true)}>
            <FiPlus size={14} /> {t('reports.generate')}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        {/* Liste rapports */}
        <Card title={<><FiFileText size={14} /> Rapports générés</>}>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
              {t('common.loading')}
            </div>
          ) : reports.length === 0 ? (
            <EmptyState icon={<FiFileText size={36} />} title={t('reports.noReports')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reports.map(r => {
                const meta = REPORT_TYPES.find(rt => rt.key === r.type) || REPORT_TYPES[0]
                return (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 10,
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 10,
                      background: 'var(--bg-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--accent-teal)', fontSize: '1.2rem', flexShrink: 0,
                    }}>
                      {meta.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                        {t(`reports.${r.type}`)} — {t(`reports.${r.period}`)}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {t('reports.generatedAt')} {r.generated_at ? format(new Date(r.generated_at), 'dd/MM/yyyy HH:mm') : '—'}
                        {' · '}{(r.total_logs || 0).toLocaleString()} logs
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDownload(r)}
                      disabled={downloadingId === r.id}
                    >
                      <FiDownload size={13} /> {downloadingId === r.id ? '…' : 'PDF'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Intégrité (auditeur) */}
        <Card title={<><FiShield size={14} /> {t('reports.integrityChecks')}</>}>
          {batches.length === 0 ? (
            <EmptyState icon={<FiShield size={30} />} title="Aucun lot d'intégrité" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {batches.map(b => (
                <div key={b.id} style={{
                  padding: '10px 12px',
                  background: b.verified ? 'rgba(63,185,80,0.05)' : 'rgba(248,81,73,0.05)',
                  border: `1px solid ${b.verified ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)'}`,
                  borderRadius: 8,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {b.period_start ? format(new Date(b.period_start), 'dd/MM HH:mm') : ''}
                    </span>
                    {b.verified
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--sev-success)' }}>
                          <FiCheckCircle size={12} /> {t('reports.verified')}
                        </span>
                      : <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--sev-critical)' }}>
                          <FiXCircle size={12} /> {t('reports.notVerified')}
                        </span>
                    }
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>
                    {b.log_count?.toLocaleString()} logs
                  </div>
                  <code style={{ fontSize: '0.62rem', color: 'var(--text-muted)', wordBreak: 'break-all', display: 'block' }}>
                    {b.sha256_hash}
                  </code>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Modal génération rapport */}
      <Modal
        isOpen={genOpen}
        onClose={() => setGenOpen(false)}
        title={t('reports.generate')}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setGenOpen(false)}>
              {t('common.cancel')}
            </button>
            <button
              className={`btn btn-primary ${generating ? 'btn-loading' : ''}`}
              onClick={handleGenerate} disabled={generating}
            >
              {!generating && t('reports.generate')}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">{t('reports.type')}</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {REPORT_TYPES.map(rt => (
              <button key={rt.key}
                className={`btn ${genType === rt.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setGenType(rt.key)}
                style={{ justifyContent: 'flex-start' }}
              >
                {rt.icon} {t(`reports.${rt.key}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{t('reports.period')}</label>
          <select className="select" value={genPeriod} onChange={e => setGenPeriod(e.target.value)}>
            {PERIODS.map(p => (
              <option key={p} value={p}>{t(`reports.${p}`)}</option>
            ))}
          </select>
        </div>

        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          padding: '10px 12px', background: 'rgba(57,213,193,0.06)',
          border: '1px solid rgba(57,213,193,0.2)', borderRadius: 8,
          fontSize: '0.78rem', color: 'var(--text-secondary)',
        }}>
          <FiTrendingUp color="var(--accent-teal)" />
          Le rapport sera généré automatiquement avec les statistiques, top alertes et incidents de la période sélectionnée.
        </div>
      </Modal>
    </div>
  )
}