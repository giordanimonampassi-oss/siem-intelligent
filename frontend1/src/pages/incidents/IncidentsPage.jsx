import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { incidentsAPI } from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Card, Badge, EmptyState } from '../../components/ui/index.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { FiLayers, FiPlus, FiUser, FiLink } from 'react-icons/fi'
import { format } from 'date-fns'

const TABS = ['', 'OPEN', 'IN_PROGRESS', 'RESOLVED']

export default function IncidentsPage() {
  const { t }   = useTranslation()
  const toast   = useToast()

  const [tab,        setTab]        = useState('')
  const [incidents,  setIncidents]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState(null)

const load = async () => {
  setLoading(true)
  try {
    const params = tab ? { status: tab } : {}
    const response = await incidentsAPI.list(params)
    const data = response.data || response
    setIncidents(Array.isArray(data) ? data : data.items || data || [])
  } catch (err) {
    console.error("Erreur incidents:", err.response?.data || err)
    toast.error(err.response?.data?.detail || t('common.error'))
    setIncidents([])
  } finally {
    setLoading(false)
  }
}

  useEffect(() => { load() }, [tab])

  const counts = {
    OPEN: incidents.filter(i => i.status === 'OPEN').length,
    IN_PROGRESS: incidents.filter(i => i.status === 'IN_PROGRESS').length,
  }

const handleUpdateStatus = async (id, status) => {
  try {
    await incidentsAPI.update(id, { status })
    toast.success('Statut mis à jour')
    load()                    // Rafraîchit la liste
    setSelected(null)
  } catch (err) {
    toast.error(err.response?.data?.detail || t('common.error'))
  }
}

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('incidents.title')}</h1>
          <p className="page-subtitle">{incidents.length} incident(s)</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TABS.map(tb => (
          <button
            key={tb}
            className={`btn btn-sm ${tab === tb ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(tb)}
          >
            {tb ? t(`incidents.status.${tb}`) : t('common.all')}
            {tb === 'OPEN' && counts.OPEN > 0 && (
              <span style={{
                marginLeft: 6, background: 'var(--sev-critical)', color: '#fff',
                fontSize: '0.65rem', padding: '1px 6px', borderRadius: 10,
              }}>{counts.OPEN}</span>
            )}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            {t('common.loading')}
          </div>
        ) : incidents.length === 0 ? (
          <EmptyState icon={<FiLayers size={40} />} title={t('incidents.noIncidents')} />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{t('common.severity')}</th>
                  <th>Titre</th>
                  <th>{t('incidents.assignedTo')}</th>
                  <th>{t('common.status')}</th>
                  <th>Créé le</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {incidents.map(inc => (
                  <tr key={inc.id} onClick={() => setSelected(inc)} style={{ cursor: 'pointer' }}>
                    <td><Badge value={inc.severity} /></td>
                    <td style={{ fontWeight: 500 }}>{inc.title}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FiUser size={13} color="var(--text-muted)" />
                        {inc.assigned_to || 'Non assigné'}
                      </div>
                    </td>
                    <td><Badge value={inc.status} /></td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {inc.created_at ? format(new Date(inc.created_at), 'dd/MM/yyyy HH:mm') : '—'}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm">
                        {t('incidents.openIncident')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal détail */}
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setSelected(null)}>
              {t('common.close')}
            </button>
            {selected?.status !== 'RESOLVED' && (
              <button className="btn btn-primary"
                onClick={() => handleUpdateStatus(selected.id, 'RESOLVED')}>
                {t('incidents.status.RESOLVED')}
              </button>
            )}
          </>
        }
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge value={selected.severity} />
              <Badge value={selected.status} />
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {selected.description || 'Aucune description disponible.'}
            </p>
            {selected.alert_id && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 8,
              }}>
                <FiLink size={14} color="var(--accent-teal)" />
                <span style={{ fontSize: '0.82rem' }}>{t('incidents.linkedAlert')} : {selected.alert_id}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {selected.status === 'OPEN' && (
                <button className="btn btn-secondary btn-sm"
                  onClick={() => handleUpdateStatus(selected.id, 'IN_PROGRESS')}>
                  → {t('incidents.status.IN_PROGRESS')}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}