import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { StatusBadge } from '../components/SeverityBadge';
import SeverityBadge from '../components/SeverityBadge';
import { CORRELATION_RULES } from '../data/mockData';

export default function CorrelationRulesPage() {
  const [selected, setSelected] = useState(CORRELATION_RULES[0]);
  const [rules, setRules] = useState(CORRELATION_RULES);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'threshold',
    mitre: 'T0000',
    severity: 'WARNING',
    threshold: '5',
    window: '5m',
    sources: ['firewall'],
    description: '',
    enabled: true,
  });

  const toggleStatus = (id) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: r.status === 'active' ? 'inactive' : 'active' } : r))
    );
    if (selected?.id === id) {
      setSelected((s) => ({ ...s, status: s.status === 'active' ? 'inactive' : 'active' }));
    }
  };

  const handleCreateRule = () => {
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setFormData({
      name: '',
      type: 'threshold',
      mitre: 'T0000',
      severity: 'WARNING',
      threshold: '5',
      window: '5m',
      sources: ['firewall'],
      description: '',
      enabled: true,
    });
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    alert('Création de règle simulée');
    closeCreateModal();
  };

  return (
    <MainLayout
      title="Règles de corrélation"
      subtitle="Moteur de détection — minimum 5 règles actives dont 2 multi-sources (EF-COR-01/03)"
    >
      <div className="rules-header">
        <p>{rules.filter((r) => r.status === 'active').length} règles actives sur {rules.length}</p>
        <button type="button" className="btn btn-primary" onClick={handleCreateRule}><Plus size={16} /> Nouvelle règle</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table clickable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom</th>
                <th>Type</th>
                <th>MITRE</th>
                <th>Statut</th>
                <th>Seuil / Fenêtre</th>
                <th>Alerte</th>
                <th>Déclenchements (7j)</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className={selected?.id === rule.id ? 'selected' : ''}
                  onClick={() => setSelected(rule)}
                >
                  <td><code>{rule.id}</code></td>
                  <td>{rule.name}</td>
                  <td><span className="type-tag">{rule.type}</span></td>
                  <td><span className="mitre-tag">{rule.mitre}</span></td>
                  <td><StatusBadge status={rule.status === 'active' ? 'actif' : 'inactif'} /></td>
                  <td>{rule.threshold ? `${rule.threshold} / ${rule.window}` : rule.window}</td>
                  <td><SeverityBadge severity={rule.severity} size="sm" /></td>
                  <td>{rule.triggers7d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="card rule-detail-panel">
          <div className="rule-detail-header">
            <div>
              <h2>{selected.name}</h2>
              <code>{selected.id}</code>
            </div>
            <button
              type="button"
              className={`btn ${selected.status === 'active' ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => toggleStatus(selected.id)}
            >
              {selected.status === 'active' ? 'Désactiver' : 'Activer'}
            </button>
          </div>
          <p>{selected.description}</p>
          <div className="detail-grid">
            <div><strong>Type</strong><p>{selected.type}</p></div>
            <div><strong>MITRE ATT&CK</strong><p>{selected.mitre}</p></div>
            <div><strong>Fenêtre temporelle</strong><p>{selected.window}</p></div>
            <div><strong>Seuil</strong><p>{selected.threshold ?? 'Séquence pattern'}</p></div>
            <div><strong>Niveau alerte</strong><p><SeverityBadge severity={selected.severity} size="sm" /></p></div>
            <div><strong>Sources</strong><p>{selected.sources.join(', ')}</p></div>
          </div>
        </div>
      )}

      {/* Modal Créer Règle */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Créer une nouvelle règle de corrélation</h2>
              <button className="modal-close" onClick={closeCreateModal}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreateSubmit}>
                <div className="form-group">
                  <label>Nom de la règle</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Brute Force Detection"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="threshold">Seuil</option>
                    <option value="sequence">Séquence</option>
                    <option value="anomaly">Anomalie</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>MITRE ATT&CK</label>
                  <input
                    type="text"
                    value={formData.mitre}
                    onChange={(e) => setFormData({ ...formData, mitre: e.target.value })}
                    placeholder="Ex: T1110"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Niveau de sévérité</label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  >
                    <option value="INFO">INFO</option>
                    <option value="WARNING">WARNING</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Seuil / Fenêtre</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={formData.threshold}
                      onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                      placeholder="Seuil"
                      style={{ flex: 1 }}
                    />
                    <input
                      type="text"
                      value={formData.window}
                      onChange={(e) => setFormData({ ...formData, window: e.target.value })}
                      placeholder="Fenêtre (ex: 5m)"
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Sources de logs (multi-sources)</label>
                  <select
                    value={formData.sources[0]}
                    onChange={(e) => setFormData({ ...formData, sources: [e.target.value] })}
                  >
                    <option value="firewall">Firewall</option>
                    <option value="auth">Authentification</option>
                    <option value="dns">DNS</option>
                    <option value="proxy">Proxy</option>
                    <option value="system">Système</option>
                    <option value="application">Application</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description de la règle et scénario d'attaque détecté"
                    rows="3"
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      style={{ width: 'auto', margin: 0 }}
                    />
                    Règle activée
                  </label>
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
    </MainLayout>
  );
}
