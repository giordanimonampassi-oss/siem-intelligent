import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { RoleBadge, StatusBadge } from '../components/SeverityBadge';
import { DEMO_USERS, ROLES } from '../data/users';
import { AUDIT_LOG } from '../data/mockData';

export default function UserAdminPage() {
  const [tab, setTab] = useState('users');
  const [users] = useState(DEMO_USERS);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: ROLES.LECTEUR,
    perimeter: 'equipe',
    title: 'Utilisateur',
  });

  const handleCreateUser = () => {
    setShowCreateModal(true);
  };

  const handleEditUser = (userId) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        perimeter: user.perimeter,
        title: user.title,
      });
      setShowEditModal(true);
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setFormData({ name: '', email: '', role: ROLES.LECTEUR, perimeter: 'equipe', title: 'Utilisateur' });
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
    setFormData({ name: '', email: '', role: ROLES.LECTEUR, perimeter: 'equipe', title: 'Utilisateur' });
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    alert('Création d\'utilisateur simulée');
    closeCreateModal();
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    alert('Modification d\'utilisateur simulée');
    closeEditModal();
  };

  return (
    <MainLayout
      title="Administration RBAC"
      subtitle="Gestion des utilisateurs et journal d'audit (EF-USR-03) — Administrateur uniquement"
    >
      <div className="tabs">
        <button type="button" className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          Utilisateurs ({users.length})
        </button>
        <button type="button" className={`tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>
          Journal d&apos;audit
        </button>
      </div>

      {tab === 'users' ? (
        <>
          <div className="rules-header">
            <p>5 comptes CTU — 3 rôles RBAC : Lecteur, Analyste, Administrateur</p>
            <button type="button" className="btn btn-primary" onClick={handleCreateUser}><UserPlus size={16} /> Créer utilisateur</button>
          </div>
          <div className="card">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Périmètre</th>
                    <th>Statut</th>
                    <th>Dernière connexion</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <span className="user-avatar sm">{u.avatar}</span>
                          <div>
                            <strong>{u.name}</strong>
                            <span>{u.title}</span>
                          </div>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td><RoleBadge role={u.role} /></td>
                      <td>{u.perimeter}</td>
                      <td><StatusBadge status={u.status} /></td>
                      <td className="nowrap">{u.lastLogin}</td>
                      <td>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleEditUser(u.id)}>Modifier</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card rbac-matrix">
            <h3>Matrice des permissions RBAC</h3>
            <div className="table-wrap">
              <table className="data-table matrix">
                <thead>
                  <tr>
                    <th>Fonctionnalité</th>
                    <th>Lecteur</th>
                    <th>Analyste</th>
                    <th>Administrateur</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Dashboard / Vue RSSI</td><td>✓</td><td>✓</td><td>✓</td></tr>
                  <tr><td>Logs bruts / Forensique</td><td>✗</td><td>✓</td><td>✓</td></tr>
                  <tr><td>Alertes & playbooks SOAR</td><td>✗</td><td>✓</td><td>✓</td></tr>
                  <tr><td>Règles de corrélation</td><td>✗</td><td>✓</td><td>✓</td></tr>
                  <tr><td>Administration utilisateurs</td><td>✗</td><td>✗</td><td>✓</td></tr>
                  <tr><td>Rapports & exports</td><td>✓</td><td>✓</td><td>✓</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <h3>Journal d&apos;audit — actions utilisateurs</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Horodatage</th>
                  <th>Utilisateur</th>
                  <th>Action</th>
                  <th>IP source</th>
                </tr>
              </thead>
              <tbody>
                {AUDIT_LOG.map((entry, i) => (
                  <tr key={i}>
                    <td className="nowrap">{entry.time}</td>
                    <td>{entry.user}</td>
                    <td>{entry.action}</td>
                    <td><code>{entry.ip}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Créer Utilisateur */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Créer un nouvel utilisateur</h2>
              <button className="modal-close" onClick={closeCreateModal}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreateSubmit}>
                <div className="form-group">
                  <label>Nom complet</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Rôle</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value={ROLES.LECTEUR}>Lecteur</option>
                    <option value={ROLES.ANALYSTE}>Analyste</option>
                    <option value={ROLES.ADMIN}>Administrateur</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Périmètre organisationnel</label>
                  <select
                    value={formData.perimeter}
                    onChange={(e) => setFormData({ ...formData, perimeter: e.target.value })}
                  >
                    <option value="equipe">Équipe</option>
                    <option value="service">Service</option>
                    <option value="filiale">Filiale</option>
                    <option value="environnement">Environnement</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Titre / Fonction</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Analyste SOC"
                    required
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeCreateModal}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Créer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifier Utilisateur */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Modifier l'utilisateur</h2>
              <button className="modal-close" onClick={closeEditModal}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditSubmit}>
                <div className="form-group">
                  <label>Nom complet</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Rôle</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value={ROLES.LECTEUR}>Lecteur</option>
                    <option value={ROLES.ANALYSTE}>Analyste</option>
                    <option value={ROLES.ADMIN}>Administrateur</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Périmètre organisationnel</label>
                  <select
                    value={formData.perimeter}
                    onChange={(e) => setFormData({ ...formData, perimeter: e.target.value })}
                  >
                    <option value="equipe">Équipe</option>
                    <option value="service">Service</option>
                    <option value="filiale">Filiale</option>
                    <option value="environnement">Environnement</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Titre / Fonction</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Analyste SOC"
                    required
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeEditModal}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
