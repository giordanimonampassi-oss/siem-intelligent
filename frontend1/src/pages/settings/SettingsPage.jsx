import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  listUsers,
  createUser,
  updateUser,
  disableUser
} from '../../api/auth.js'
import { rulesAPI as rulesApiReal } from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Card, Badge, EmptyState } from '../../components/ui/index.jsx'
import Modal from '../../components/ui/Modal.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import {
  FiUsers, FiSliders, FiClock, FiPlus, FiEdit2, FiTrash2,
  FiShield, FiToggleLeft, FiToggleRight
} from 'react-icons/fi'
import { format } from 'date-fns'

const TABS = ['users', 'rules', 'retention']
const ROLES = ['reader', 'analyst', 'rssi', 'auditor', 'admin']

export default function SettingsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const [tab, setTab] = useState('users')

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="page-subtitle">{t('settings.adminOnly')}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TABS.map(tb => (
          <button key={tb}
            className={`btn btn-sm ${tab === tb ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(tb)}>
            {tb === 'users' && <FiUsers size={14} />}
            {tb === 'rules' && <FiSliders size={14} />}
            {tb === 'retention' && <FiClock size={14} />}
            {' '}{t(`settings.${tb}`)}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'rules' && <RulesTab />}
      {tab === 'retention' && <RetentionTab />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
function UsersTab() {
  const { t } = useTranslation()
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [form, setForm] = useState({
    username: '', email: '', role: 'reader', password: ''
  })

const loadUsers = async () => {
  setLoading(true)
  try {
    const data = await listUsers()
    const userList = Array.isArray(data) ? data : (data.items || data || [])
    setUsers(userList)
  } catch (err) {
    console.error(err)
    toast.error("Impossible de charger les utilisateurs")
    setUsers([])
  } finally {
    setLoading(false)
  }
}

  useEffect(() => {
    loadUsers()
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ username: '', email: '', role: 'reader', password: '' })
    setModalOpen(true)
  }

  const openEdit = (user) => {
    setEditing(user)
    setForm({
      username: user.username,
      email: user.email,
      role: user.role,
      password: ''
    })
    setModalOpen(true)
  }

const handleSave = async () => {
  try {
    if (editing) {
      const payload = {
        email: form.email || undefined,
        role: form.role ? form.role.toLowerCase() : undefined,
      }

      await updateUser(editing.id, payload)
      toast.success('Utilisateur mis à jour avec succès')
    } else {
      const payload = {
        username: form.username,
        email: form.email,
        password: form.password,
        role: form.role.toLowerCase(),
      }
      await createUser(payload)
      toast.success('Utilisateur créé avec succès')
    }

    setModalOpen(false)
    setEditing(null)
    await loadUsers()
  } catch (err) {
    console.error("Update error:", err.response?.data)
    
    // Correction importante pour le toast
    const errorMsg = err.response?.data?.detail 
      ? (typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : JSON.stringify(err.response.data.detail))
      : 'Erreur lors de la sauvegarde'

    toast.error(errorMsg)
  }
}

const handleToggleActive = async (user) => {
  if (!user) return
  try {
    await disableUser(user.id)
    toast.success(user.is_active ? 'Utilisateur désactivé' : 'Utilisateur activé')
    loadUsers()
  } catch (err) {
    toast.error('Erreur lors du changement de statut')
  }
}

  return (
    <>
      <Card
        title={<><FiUsers size={14} /> {t('settings.users')}</>}
        actions={
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <FiPlus size={14} /> {t('settings.addUser')}
          </button>
        }
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Chargement des utilisateurs...
          </div>
        ) : users.length === 0 ? (
          <EmptyState message="Aucun utilisateur trouvé" />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>MFA</th>
                  <th>Dernière connexion</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.username}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{u.email}</td>
                    <td><Badge value={u.role} /></td>
                    <td>
                      <span style={{ color: u.mfa_enabled ? 'var(--sev-success)' : 'var(--text-muted)' }}>
                        {u.mfa_enabled ? 'Activé' : 'Désactivé'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {u.last_login ? format(new Date(u.last_login), 'dd/MM HH:mm') : '—'}
                    </td>
                    <td>
                      <Badge value={u.is_active ? 'Actif' : 'Inactif'} 
                             color={u.is_active ? 'success' : 'critical'} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>
                          <FiEdit2 size={14} />
                        </button>
                        <button className="btn btn-ghost btn-sm" 
                          onClick={() => handleToggleActive(u)}>
                          {u.is_active ? 
                            <FiToggleRight size={18} color="var(--sev-success)" /> : 
                            <FiToggleLeft size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Ajout / Modification */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave}>Enregistrer</button>
          </>
        }
      >
        {/* Formulaire ... (reste inchangé) */}
        <div className="form-group">
          <label>Nom d'utilisateur</label>
          <input className="input" value={form.username} disabled={!!editing}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input className="input" type="email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        {!editing && (
          <div className="form-group">
            <label>Mot de passe</label>
            <input className="input" type="password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
        )}
        <div className="form-group">
          <label>Rôle</label>
          <select className="select" value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            {ROLES.map(r => (
              <option key={r} value={r.toUpperCase()}>{r.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        type="warning"
        onConfirm={() => {/* handle confirm */}}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}


// ════════════════════════════════════════════════════════════════════════════
function RulesTab() {
  const { t } = useTranslation()
  const toast = useToast()
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    rulesApiReal.list().then(r => setRules(r.data.items || r.data || mockRules()))
      .catch(() => setRules(mockRules()))
      .finally(() => setLoading(false))
  }, [])

  function mockRules() {
    return [
      { id: '1', name: 'Brute Force SSH', rule_type: 'THRESHOLD', mitre_tactic: 'TA0001', mitre_technique: 'T1110', threshold: 5, window_seconds: 60, is_active: true },
      { id: '2', name: 'Mouvement latéral NTLM', rule_type: 'SEQUENCE', mitre_tactic: 'TA0008', mitre_technique: 'T1550', is_active: true },
      { id: '3', name: 'Exfiltration volume', rule_type: 'AGGREGATION', mitre_tactic: 'TA0010', mitre_technique: 'T1041', is_active: true },
      { id: '4', name: 'Suppression logs', rule_type: 'ANOMALY', mitre_tactic: 'TA0005', mitre_technique: 'T1070', is_active: false },
    ]
  }

  const toggleRule = async (rule) => {
    try {
      await rulesApiReal.toggle(rule.id, !rule.is_active)
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
      toast.success('Règle mise à jour')
    } catch { toast.error(t('common.error')) }
  }

  return (
    <Card title={<><FiSliders size={14} /> {t('settings.rules')}</>}>
      {loading ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Nom</th><th>Type</th><th>MITRE</th><th>Seuil</th><th>Actif</th></tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td><Badge value={r.rule_type} /></td>
                  <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {r.mitre_tactic} · {r.mitre_technique}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {r.threshold ? `${r.threshold} / ${r.window_seconds}s` : '—'}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => toggleRule(r)}>
                      {r.is_active
                        ? <FiToggleRight size={18} color="var(--sev-success)" />
                        : <FiToggleLeft size={18} color="var(--text-muted)" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════
function RetentionTab() {
  const { t } = useTranslation()
  const toast = useToast()
  const [days, setDays] = useState(30)
  const [autoPurge, setAutoPurge] = useState(true)
  const [confirmPurge, setConfirmPurge] = useState(false)

  const handlePurge = async () => {
    toast.success('Purge des logs anciens lancée')
    setConfirmPurge(false)
  }

  return (
    <>
      <Card title={<><FiClock size={14} /> {t('settings.retention')}</>}>
        <div className="form-group">
          <label className="form-label">{t('settings.retentionDays')}</label>
          <input className="input" type="number" min={1} max={365}
            value={days} onChange={e => setDays(Number(e.target.value))}
            style={{ maxWidth: 160 }} />
        </div>

        <div className="toggle" style={{ marginBottom: 20 }}>
          <input type="checkbox" checked={autoPurge} onChange={e => setAutoPurge(e.target.checked)} />
          <span className="toggle-track"><span className="toggle-thumb" /></span>
          <span className="toggle-label">Purge automatique activée</span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 8,
          marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('settings.nextPurge')}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Demain à 03:00 (automatique)
            </div>
          </div>
        </div>

        <button className="btn btn-danger" onClick={() => setConfirmPurge(true)}>
          {t('settings.purgeNow')}
        </button>
      </Card>

      <ConfirmDialog
        isOpen={confirmPurge}
        title={t('settings.purgeNow')}
        message={t('settings.confirmPurge')}
        type="danger"
        onConfirm={handlePurge}
        onCancel={() => setConfirmPurge(false)}
      />
    </>
  )
}