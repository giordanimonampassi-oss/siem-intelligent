import { useState, useMemo } from 'react';
import { Search, Clock, Flag } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import SeverityBadge from '../components/SeverityBadge';
import { FORENSIC_LOGS } from '../data/mockData';

export default function ForensicsPage() {
  const [mode, setMode] = useState('search');
  const [filters, setFilters] = useState({
    sourceIp: '',
    user: '',
    type: 'all',
    severity: 'all',
    dateFrom: '',
    dateTo: '',
  });
  const [pivotHistory, setPivotHistory] = useState([]);
  const [marked, setMarked] = useState(new Set());

  const results = useMemo(() => {
    return FORENSIC_LOGS.filter((log) => {
      if (filters.sourceIp && !log.sourceIp?.includes(filters.sourceIp)) return false;
      if (filters.user && !log.user?.toLowerCase().includes(filters.user.toLowerCase())) return false;
      if (filters.type !== 'all' && log.type !== filters.type) return false;
      if (filters.severity !== 'all' && log.severity !== filters.severity) return false;
      if (filters.dateFrom && log.timestamp < filters.dateFrom) return false;
      if (filters.dateTo && log.timestamp > filters.dateTo + ' 23:59') return false;
      return true;
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [filters]);

  const pivot = (field, value) => {
    if (!value) return;
    setPivotHistory((h) => [...h, { field, value }]);
    if (field === 'ip') setFilters((f) => ({ ...f, sourceIp: value }));
    if (field === 'user') setFilters((f) => ({ ...f, user: value }));
  };

  const toggleMark = (id) => {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <MainLayout
      title="Recherche forensique"
      subtitle="Investigation multi-critères et timeline interactive (EF-FOR-01/03)"
    >
      <div className="tabs">
        <button type="button" className={`tab ${mode === 'search' ? 'active' : ''}`} onClick={() => setMode('search')}>
          <Search size={16} /> Mode recherche
        </button>
        <button type="button" className={`tab ${mode === 'timeline' ? 'active' : ''}`} onClick={() => setMode('timeline')}>
          <Clock size={16} /> Timeline
        </button>
      </div>

      <div className="card filters-card">
        <div className="filters-grid">
          <input
            placeholder="IP source"
            value={filters.sourceIp}
            onChange={(e) => setFilters({ ...filters, sourceIp: e.target.value })}
          />
          <input
            placeholder="Utilisateur"
            value={filters.user}
            onChange={(e) => setFilters({ ...filters, user: e.target.value })}
          />
          <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
            <option value="all">Tous types</option>
            <option value="auth">Auth</option>
            <option value="réseau">Réseau</option>
            <option value="système">Système</option>
            <option value="application">Application</option>
          </select>
          <select value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}>
            <option value="all">Toutes criticités</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <input type="datetime-local" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value.replace('T', ' ') })} />
          <input type="datetime-local" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value.replace('T', ' ') })} />
        </div>
        {pivotHistory.length > 0 && (
          <div className="pivot-breadcrumb">
            Pivots actifs :
            {pivotHistory.map((p, i) => (
              <span key={i} className="pivot-chip">{p.field}: {p.value}</span>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPivotHistory([]); setFilters({ sourceIp: '', user: '', type: 'all', severity: 'all', dateFrom: '', dateTo: '' }); }}>
              Effacer pivots
            </button>
          </div>
        )}
      </div>

      {mode === 'search' ? (
        <div className="card">
          <p className="results-count">{results.length} résultat(s) — triés du plus récent au plus ancien</p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Horodatage</th>
                  <th>IP source</th>
                  <th>Utilisateur</th>
                  <th>Hôte</th>
                  <th>Type</th>
                  <th>Niveau</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {results.map((log) => (
                  <tr key={log.id} className={marked.has(log.id) ? 'marked-row' : ''}>
                    <td>
                      <button type="button" className={`btn-icon mark-btn ${marked.has(log.id) ? 'marked' : ''}`} onClick={() => toggleMark(log.id)} title="Marquer suspect">
                        <Flag size={14} />
                      </button>
                    </td>
                    <td className="nowrap">{log.timestamp}</td>
                    <td>
                      {log.sourceIp ? (
                        <button type="button" className="pivot-link" onClick={() => pivot('ip', log.sourceIp)}>{log.sourceIp}</button>
                      ) : '—'}
                    </td>
                    <td>
                      {log.user ? (
                        <button type="button" className="pivot-link" onClick={() => pivot('user', log.user)}>{log.user}</button>
                      ) : '—'}
                    </td>
                    <td><code>{log.host}</code></td>
                    <td>{log.type}</td>
                    <td><SeverityBadge severity={log.severity.toUpperCase()} size="sm" /></td>
                    <td>{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card timeline-view">
          <p className="results-count">Séquence chronologique — {results.length} événement(s)</p>
          <div className="timeline">
            {[...results].reverse().map((log, i) => (
              <div key={log.id} className={`timeline-item severity-${log.severity}`}>
                <div className="timeline-marker" />
                <div className="timeline-content">
                  <time>{log.timestamp}</time>
                  <strong>{log.message}</strong>
                  <div className="timeline-meta">
                    {log.sourceIp && (
                      <button type="button" className="pivot-link" onClick={() => pivot('ip', log.sourceIp)}>{log.sourceIp}</button>
                    )}
                    {log.user && (
                      <button type="button" className="pivot-link" onClick={() => pivot('user', log.user)}>{log.user}</button>
                    )}
                    <span>{log.host}</span>
                    <SeverityBadge severity={log.severity.toUpperCase()} size="sm" />
                  </div>
                </div>
                {i < results.length - 1 && <div className="timeline-connector" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </MainLayout>
  );
}
