import { useState, useMemo } from 'react';
import { Play, X, X as CloseIcon, ChevronRight } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import SeverityBadge, { StatusBadge } from '../components/SeverityBadge';
import { INCIDENTS } from '../data/mockData';
import { canModifyIncidents } from '../utils/rbac';
import { useAuth } from '../context/AuthContext';

export default function AlertsPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const filtered = useMemo(() => {
    return INCIDENTS.filter((inc) => {
      if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
      if (dateFilter && !inc.createdAt.startsWith(dateFilter)) return false;
      return true;
    });
  }, [severityFilter, statusFilter, dateFilter]);

  const closeModal = () => setSelected(null);

  const handleExecutePlaybook = () => {
    setShowPlaybookModal(true);
  };

  const handleChangeStatus = () => {
    setShowStatusModal(true);
  };

  const closePlaybookModal = () => setShowPlaybookModal(false);
  const closeStatusModal = () => setShowStatusModal(false);

  const confirmPlaybook = () => {
    alert('Exécution du playbook SOAR simulée');
    closePlaybookModal();
  };

  const confirmStatusChange = (newStatus) => {
    alert(`Changement de statut vers ${newStatus} simulé`);
    closeStatusModal();
  };

  return (
    <MainLayout
      title="Alertes & Incidents"
      subtitle="Tableau de suivi SOC — pattern master-detail"
    >
      <div className="filters-bar">
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
          <option value="all">Tous niveaux</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="WARNING">WARNING</option>
          <option value="INFO">INFO</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Tous statuts</option>
          <option value="ouvert">Ouvert</option>
          <option value="en_cours">En cours</option>
          <option value="résolu">Résolu</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          placeholder="Filtrer par date"
        />
        {(severityFilter !== 'all' || statusFilter !== 'all' || dateFilter) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => { setSeverityFilter('all'); setStatusFilter('all'); setDateFilter(''); }}
          >
            <X size={14} /> Réinitialiser
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table clickable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Titre</th>
                <th>Niveau</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Analyste</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inc) => (
                <tr
                  key={inc.id}
                  onClick={() => setSelected(inc)}
                >
                  <td><code>{inc.id}</code></td>
                  <td>{inc.title}</td>
                  <td><SeverityBadge severity={inc.severity} size="sm" /></td>
                  <td className="nowrap">{inc.createdAt}</td>
                  <td><StatusBadge status={inc.status} /></td>
                  <td>{inc.assignedTo}</td>
                  <td className="click-indicator">
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal flottant pour les détails */}
      {selected && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <SeverityBadge severity={selected.severity} />
                <h2>{selected.title}</h2>
                <code>{selected.id}</code>
              </div>
              <div className="modal-header-right">
                <StatusBadge status={selected.status} />
                <button className="modal-close" onClick={closeModal}>
                  <CloseIcon size={20} />
                </button>
              </div>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-section">
                  <h4>Règle déclenchée</h4>
                  <p>{selected.rule}</p>
                  <span className="mitre-tag">{selected.mitre}</span>
                </div>
                <div className="detail-section">
                  <h4>Score de confiance</h4>
                  <div className="confidence-bar">
                    <div className="confidence-fill" style={{ width: `${selected.confidence}%` }} />
                    <span>{selected.confidence}%</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Entités impliquées</h4>
                <div className="entity-tags">
                  {selected.entities.ip && <span className="entity-tag">IP: {selected.entities.ip}</span>}
                  {selected.entities.user && <span className="entity-tag">User: {selected.entities.user}</span>}
                  {selected.entities.host && <span className="entity-tag">Host: {selected.entities.host}</span>}
                </div>
              </div>

              <div className="detail-section">
                <h4>Logs associés</h4>
                <pre className="log-block">{selected.logs.join('\n')}</pre>
              </div>

              {selected.soarActions.length > 0 && (
                <div className="detail-section">
                  <h4>Actions SOAR exécutées</h4>
                  <ul className="soar-list">
                    {selected.soarActions.map((a, i) => (
                      <li key={i}>
                        <span className={`soar-status soar-${a.status.replace(/\s/g, '-')}`}>{a.status}</span>
                        <span>{a.action}</span>
                        <time>{a.time}</time>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {canModifyIncidents(user.role) && (
              <div className="modal-footer">
                <button type="button" className="btn btn-primary" onClick={handleExecutePlaybook}>
                  <Play size={16} /> Exécuter playbook
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleChangeStatus}>Changer statut</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Exécuter Playbook */}
      {showPlaybookModal && (
        <div className="modal-overlay" onClick={closePlaybookModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Exécuter Playbook SOAR</h2>
              <button className="modal-close" onClick={closePlaybookModal}>
                <CloseIcon size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>Êtes-vous sûr de vouloir exécuter le playbook SOAR pour cet incident ?</p>
              <p><strong>Incident:</strong> {selected?.title}</p>
              <p><strong>ID:</strong> {selected?.id}</p>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closePlaybookModal}>
                  Annuler
                </button>
                <button type="button" className="btn btn-primary" onClick={confirmPlaybook}>
                  <Play size={16} /> Exécuter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Changer Statut */}
      {showStatusModal && (
        <div className="modal-overlay" onClick={closeStatusModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Changer le statut</h2>
              <button className="modal-close" onClick={closeStatusModal}>
                <CloseIcon size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>Sélectionnez le nouveau statut pour cet incident :</p>
              <p><strong>Incident:</strong> {selected?.title}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => confirmStatusChange('ouvert')}>
                  Ouvert
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => confirmStatusChange('en_cours')}>
                  En cours
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => confirmStatusChange('résolu')}>
                  Résolu
                </button>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeStatusModal}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
