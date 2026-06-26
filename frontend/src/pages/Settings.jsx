import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import * as authApi from '../api/auth'

const ROLE_COLORS = {
  ADMIN:   { bg: 'rgba(138,99,210,.2)',  color: '#a78bfa' },
  ANALYST: { bg: 'rgba(88,166,255,.2)',  color: '#58A6FF' },
  RSSI:    { bg: 'rgba(57,213,193,.2)',  color: '#39D5C1' },
  AUDITOR: { bg: 'rgba(227,163,37,.2)',  color: '#E3A325' },
  READER:  { bg: 'rgba(139,148,158,.2)', color: '#8B949E' },
}

const TABS = [
  "Utilisateurs & roles",
  "Regles de correlation",
  "Politique de retention",
  "Journal d'audit",
]

export function Settings() {
  const { user: currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState(0)
  const [users, setUsers]         = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading]     = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [newUser, setNewUser]     = useState({
    username: '', email: '', password: '', role: 'READER',
    perimeter: ['NETWORK', 'AUTH'],
  })
  const [feedback, setFeedback] = useState('')

  const isAdmin = currentUser?.role === 'ADMIN'

  useEffect(() => {
    if (activeTab === 0 && isAdmin) {
      setLoading(true)
      authApi.listUsers()
        .then(setUsers)
        .catch(() => {})
        .finally(() => setLoading(false))
    }
    if (activeTab === 3) {
      authApi.getAuditLog()
        .then(setAuditLogs)
        .catch(() => {})
    }
  }, [activeTab, isAdmin])

  async function handleCreateUser(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const created = await authApi.createUser(newUser)
      setUsers(prev => [...prev, created])
      setShowModal(false)
      setFeedback('Utilisateur ' + created.username + ' cree')
      setNewUser({ username: '', email: '', password: '', role: 'READER', perimeter: ['NETWORK', 'AUTH'] })
    } catch (err) {
      setFeedback(err.response?.data?.detail || 'Erreur creation')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisable(userId) {
    if (!confirm('Desactiver ce compte ?')) return
    try {
      await authApi.disableUser(userId)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: false } : u))
      setFeedback('Compte desactive')
    } catch (err) {
      setFeedback(err.response?.data?.detail || 'Erreur')
    }
  }

  function togglePerimeter(perm) {
    setNewUser(prev => ({
      ...prev,
      perimeter: prev.perimeter.includes(perm)
        ? prev.perimeter.filter(p => p !== perm)
        : [...prev.perimeter, perm],
    }))
  }

  return (
    <section className="page">
      <div className="page-title">
        <h1>Administration système</h1>
        <p>Gérer les utilisateurs, règles de corrélation, rétention et gouvernance des données.</p>
      </div>

      {feedback && (
        <div style={{
          padding: '8px 14px',
          background: 'rgba(63,185,80,.1)',
          border: '1px solid var(--success)',
          borderRadius: 6,
          color: 'var(--success)',
          fontSize: 12,
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {feedback}
          <button
            style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer' }}
            onClick={() => setFeedback('')}
          >
            x
          </button>
        </div>
      )}

      <div className="tabs overflow-auto">
        {TABS.map((t, i) => (
          <button
            key={i}
            type="button"
            className={activeTab === i ? 'active' : ''}
            onClick={() => setActiveTab(i)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab 0 : Utilisateurs */}
      {activeTab === 0 && (
        <section className="panel">
          <div className="panel-header">
            <h2>Gestion des identités</h2>
            {isAdmin && (
              <button className="primary-button" onClick={() => setShowModal(true)}>
                + Ajouter un utilisateur
              </button>
            )}
          </div>

          {!isAdmin && (
            <div style={{ padding: 20, color: 'var(--text2)', textAlign: 'center' }}>
              <i className="bi bi-lock-fill" style={{ marginRight: 8 }}></i>
              Réservé aux administrateurs
            </div>
          )}

          {isAdmin && (
            <div className="table-responsive">
              <table className="table siem-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Rôle</th>
                    <th>Statut MFA</th>
                    <th>Dernière connexion</th>
                    <th>Statut</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--text2)' }}>
                        <i className="bi bi-arrow-repeat spin"></i> Chargement...
                      </td>
                    </tr>
                  )}
                  {users.map(u => {
                    const roleStyle = ROLE_COLORS[u.role] || ROLE_COLORS.READER
                    return (
                      <tr key={u.id}>
                        <td>
                          <strong style={{ display: 'block' }}>{u.username}</strong>
                          <small style={{ color: 'var(--text2)' }}>{u.email}</small>
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              ...roleStyle,
                              padding: '2px 8px',
                              borderRadius: 20,
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td style={{ color: u.mfa_enabled ? 'var(--success)' : 'var(--warning)' }}>
                          {u.mfa_enabled ? 'Actif' : 'Non configure'}
                        </td>
                        <td style={{ fontSize: 11, fontFamily: 'monospace' }}>
                          {u.last_login
                            ? new Date(u.last_login).toLocaleString('fr-FR')
                            : '—'}
                        </td>
                        <td>
                          <span style={{
                            fontSize: 10,
                            padding: '2px 8px',
                            borderRadius: 20,
                            background: u.is_active
                              ? 'rgba(63,185,80,.15)'
                              : 'rgba(248,81,73,.15)',
                            color: u.is_active ? 'var(--success)' : 'var(--critical)',
                          }}>
                            {u.is_active ? 'Actif' : 'Desactive'}
                          </span>
                        </td>
                        <td>
                          <span className="row-actions justify-content-end">
                            {u.is_active && u.id !== currentUser?.id && (
                              <button
                                className="icon-button alert-text"
                                title="Desactiver"
                                onClick={() => handleDisable(u.id)}
                              >
                                <i className="bi bi-person-x-fill"></i>
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 1 : Regles */}
      {activeTab === 1 && (
        <section className="panel">
          <div className="panel-header">
            <h2>Règles de corrélation</h2>
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>Disponible — Module 2</span>
          </div>
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>
            <i className="bi bi-diagram-3" style={{ fontSize: 32, display: 'block', marginBottom: 12 }}></i>
            Les règles de corrélation seront configurables ici (Module 2 — Semaine 2)
          </div>
        </section>
      )}

      {/* Tab 2 : Retention */}
      {activeTab === 2 && (
        <section className="panel">
          <div className="panel-header">
            <h2>Politique de rétention</h2>
          </div>
          <div style={{ maxWidth: 480 }}>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                Conserver les logs pendant
              </label>
              <select style={{ width: '100%' }}>
                <option>30 jours</option>
                <option>6 mois</option>
                <option>1 an</option>
              </select>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 12, background: 'var(--bg)', borderRadius: 6,
              border: '1px solid var(--border)', marginBottom: 12,
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Purge automatique</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                  Supprime les logs expirés automatiquement
                </div>
              </div>
              <label className="rule-toggle">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 12, background: 'var(--bg)', borderRadius: 6,
              border: '1px solid var(--border)', marginBottom: 16,
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Verification SHA-256</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                  Hash de chaque lot pour la chaine de preuve
                </div>
              </div>
              <label className="rule-toggle">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <button className="primary-button">Sauvegarder</button>
          </div>
        </section>
      )}

      {/* Tab 3 : Audit */}
      {activeTab === 3 && (
        <section className="panel">
          <div className="panel-header">
            <h2>Journal d'audit</h2>
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>{auditLogs.length} entrees</span>
          </div>
          <table className="table siem-table">
            <thead>
              <tr>
                <th>Horodatage</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Cible</th>
                <th>IP</th>
                <th>Resultat</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--text2)' }}>
                    {currentUser?.role === 'AUDITOR' || currentUser?.role === 'ADMIN'
                      ? 'Aucune entree'
                      : 'Reserve aux auditeurs et administrateurs'}
                  </td>
                </tr>
              )}
              {auditLogs.map(l => (
                <tr key={l.id}>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {new Date(l.created_at).toLocaleString('fr-FR')}
                  </td>
                  <td style={{ fontSize: 11 }}>{l.user_id?.slice(0, 8) || 'systeme'}</td>
                  <td>
                    <span className="sev-badge sev-info" style={{ fontSize: 9 }}>{l.action}</span>
                  </td>
                  <td style={{ fontSize: 11 }}>{l.target_entity || '—'}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{l.ip_address || '—'}</td>
                  <td>
                    <span style={{
                      fontSize: 10,
                      color: l.result === 'success' ? 'var(--success)' : 'var(--critical)',
                    }}>
                      {l.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Modal creation utilisateur */}
      {showModal && (
        <div className="modal-overlay open">
          <div className="modal">
            <div className="modal-title">
              Ajouter un utilisateur
              <button className="btn btn-sm" onClick={() => setShowModal(false)}>x</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label style={{ fontSize: 11, color: 'var(--text2)' }}>Nom utilisateur</label>
                  <input
                    required
                    value={newUser.username}
                    onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))}
                    placeholder="jbauer"
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 11, color: 'var(--text2)' }}>Email</label>
                  <input
                    required
                    type="email"
                    value={newUser.email}
                    onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                    placeholder="j@ctu.gov"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text2)' }}>Mot de passe</label>
                <input
                  required
                  type="password"
                  value={newUser.password}
                  onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                  placeholder="Min. 8 caracteres"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text2)' }}>Role</label>
                <select
                  value={newUser.role}
                  onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  {['READER', 'ANALYST', 'RSSI', 'AUDITOR', 'ADMIN'].map(r => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                  Perimetre acces
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {['NETWORK', 'AUTH', 'SYSTEM', 'APPLICATION', 'CLOUD'].map(p => (
                    <label
                      key={p}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={newUser.perimeter.includes(p)}
                        onChange={() => togglePerimeter(p)}
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creation...' : 'Creer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}