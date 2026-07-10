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
  const [deleteTarget, setDeleteTarget] = useState(null)

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


// Remplace entierement la fonction RulesTab() par celle-ci
function RulesTab() {
  const { t } = useTranslation()
  const toast = useToast()
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState({
    name: '', description: '', rule_type: 'THRESHOLD',
    mitre_tactic: '', mitre_technique: '', threshold: 5, time_window_sec: 60,
    alert_level: 'WARNING', confidence_score: 0.8, is_active: true,
  })

  const load = () => {
    setLoading(true)
    rulesApiReal.list().then(r => setRules(r.data.results || r.data.items || r.data || mockRules()))
      .catch(() => setRules(mockRules()))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

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
      await rulesApiReal.toggle(rule.id)
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
      toast.success('Règle mise à jour')
    } catch { toast.error(t('common.error')) }
  }

  const handleCreate = async () => {
    try {
      await rulesApiReal.create({
        ...form,
        mitre_tactic: form.mitre_tactic || null,
        mitre_technique: form.mitre_technique || null,
      })
      toast.success('Règle créée')
      setCreateOpen(false)
      setForm({ name: '', description: '', rule_type: 'THRESHOLD', mitre_tactic: '', mitre_technique: '', threshold: 5, time_window_sec: 60, alert_level: 'WARNING', confidence_score: 0.8, is_active: true })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await rulesApiReal.delete(deleteTarget.id)
      toast.success('Règle supprimée')
      setRules(prev => prev.filter(r => r.id !== deleteTarget.id))
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'))
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <>
      <Card
        title={<><FiSliders size={14} /> {t('settings.rules')}</>}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
            <FiPlus size={14} /> Nouvelle règle
          </button>
        }
      >
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Nom</th><th>Type</th><th>MITRE</th><th>Seuil</th><th>Actif</th><th>Actions</th></tr>
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
                      {r.threshold ? `${r.threshold} / ${r.time_window_sec || r.window_seconds}s` : '—'}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => toggleRule(r)}>
                        {r.is_active
                          ? <FiToggleRight size={18} color="var(--sev-success)" />
                          : <FiToggleLeft size={18} color="var(--text-muted)" />}
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => setDeleteTarget(r)}
                        title="Supprimer la règle"
                      >
                        <FiTrash2 size={14} color="var(--sev-critical)" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouvelle règle de corrélation"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={!form.name}>Créer</button>
          </>
        }
      >
        <div className="form-group">
          <label>Nom</label>
          <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Description</label>
          <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Type de règle</label>
          <select className="select" value={form.rule_type} onChange={e => setForm(f => ({ ...f, rule_type: e.target.value }))}>
            <option value="THRESHOLD">Seuil (threshold)</option>
            <option value="SEQUENCE">Séquentielle (pattern)</option>
            <option value="AGGREGATION">Agrégation</option>
            <option value="ANOMALY">Anomalie</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Tactique MITRE</label>
            <input className="input" value={form.mitre_tactic} placeholder="ex: Initial Access"
              onChange={e => setForm(f => ({ ...f, mitre_tactic: e.target.value }))} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Technique MITRE</label>
            <input className="input" value={form.mitre_technique} placeholder="ex: T1110"
              onChange={e => setForm(f => ({ ...f, mitre_technique: e.target.value }))} />
          </div>
        </div>
        {form.rule_type === 'THRESHOLD' && (
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Seuil (nb événements)</label>
              <input className="input" type="number" min={1} value={form.threshold}
                onChange={e => setForm(f => ({ ...f, threshold: Number(e.target.value) }))} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Fenêtre (secondes)</label>
              <input className="input" type="number" min={5} value={form.time_window_sec}
                onChange={e => setForm(f => ({ ...f, time_window_sec: Number(e.target.value) }))} />
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Niveau d'alerte</label>
            <select className="select" value={form.alert_level} onChange={e => setForm(f => ({ ...f, alert_level: e.target.value }))}>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Score de confiance</label>
            <input className="input" type="number" min={0} max={1} step={0.05} value={form.confidence_score}
              onChange={e => setForm(f => ({ ...f, confidence_score: Number(e.target.value) }))} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Supprimer cette règle ?"
        message={deleteTarget ? `« ${deleteTarget.name} » sera définitivement supprimée. Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
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
    </>
  )
}