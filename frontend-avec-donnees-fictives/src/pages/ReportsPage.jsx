import { useState } from 'react';
import { Download, FileText, Plus } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { StatusBadge } from '../components/SeverityBadge';
import { REPORTS } from '../data/mockData';

export default function ReportsPage() {
  const [generating, setGenerating] = useState(false);
  const [customForm, setCustomForm] = useState({
    dateFrom: '2026-03-14',
    dateTo: '2026-03-25',
    includeAlerts: true,
    includeIncidents: true,
    includeCompliance: true,
  });

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 1500);
  };

  const handleDownloadPdf = (reportId) => {
    alert(`Téléchargement PDF du rapport ${reportId} simulé`);
  };

  const handleExport = (format) => {
    alert(`Export ${format} simulé — les données filtrées seraient téléchargées.`);
  };

  return (
    <MainLayout
      title="Rapports & Exports"
      subtitle="Génération PDF automatique et exports CSV/Excel (EF-VIZ-05/06)"
    >
      <div className="reports-grid">
        <div className="card">
          <div className="card-header">
            <h3><FileText size={18} /> Rapports générés</h3>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Taille</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {REPORTS.map((r) => (
                  <tr key={r.id}>
                    <td><code>{r.id}</code></td>
                    <td>{r.name}</td>
                    <td><span className="type-tag">{r.type}</span></td>
                    <td>{r.date}</td>
                    <td>{r.size}</td>
                    <td><StatusBadge status="actif" /></td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDownloadPdf(r.id)}>
                        <Download size={14} /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Générer un rapport personnalisé</h3>
          <div className="form-stack">
            <div className="form-row">
              <label>Date début</label>
              <input type="date" value={customForm.dateFrom} onChange={(e) => setCustomForm({ ...customForm, dateFrom: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Date fin</label>
              <input type="date" value={customForm.dateTo} onChange={(e) => setCustomForm({ ...customForm, dateTo: e.target.value })} />
            </div>
            <div className="checkbox-group">
              <label><input type="checkbox" checked={customForm.includeAlerts} onChange={(e) => setCustomForm({ ...customForm, includeAlerts: e.target.checked })} /> Alertes & statistiques</label>
              <label><input type="checkbox" checked={customForm.includeIncidents} onChange={(e) => setCustomForm({ ...customForm, includeIncidents: e.target.checked })} /> Incidents traités</label>
              <label><input type="checkbox" checked={customForm.includeCompliance} onChange={(e) => setCustomForm({ ...customForm, includeCompliance: e.target.checked })} /> Conformité ISO/RGPD</label>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
              <Plus size={16} /> {generating ? 'Génération…' : 'Générer rapport PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="card export-section">
        <h3>Export rapide de données</h3>
        <p>Exporter les logs ou alertes filtrés pour audit externe</p>
        <div className="export-actions">
          <select defaultValue="alertes">
            <option value="alertes">Alertes & incidents</option>
            <option value="logs">Logs normalisés</option>
            <option value="regles">Règles de corrélation</option>
            <option value="audit">Journal d&apos;audit</option>
          </select>
          <select defaultValue="7d">
            <option value="24h">Dernières 24h</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
          </select>
          <button type="button" className="btn btn-secondary" onClick={() => handleExport('CSV')}>
            <Download size={16} /> Export CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => handleExport('Excel')}>
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>
    </MainLayout>
  );
}
