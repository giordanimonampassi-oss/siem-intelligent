import { Link } from 'react-router-dom';
import { AlertTriangle, Activity, FileWarning, Clock } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import MainLayout from '../components/MainLayout';
import SeverityBadge from '../components/SeverityBadge';
import { INCIDENTS, LOG_VOLUME_24H, TOP_SOURCE_IPS } from '../data/mockData';

function StatCard({ icon: Icon, label, value, color, trend }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ backgroundColor: `${color}20`, color }}>
        <Icon size={22} />
      </div>
      <div>
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {trend && <span className="stat-trend">{trend}</span>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const critical = INCIDENTS.filter((i) => i.severity === 'CRITICAL' && i.status !== 'résolu').length;
  const high = INCIDENTS.filter((i) => i.severity === 'HIGH' && i.status !== 'résolu').length;
  const open = INCIDENTS.filter((i) => i.status !== 'résolu').length;
  const recentAlerts = [...INCIDENTS].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);

  return (
    <MainLayout
      title="Dashboard principal"
      subtitle="Vue globale en temps réel — CTU Security Operations"
    >
      <div className="stats-grid">
        <StatCard icon={AlertTriangle} label="Alertes CRITICAL" value={critical} color="#f85149" />
        <StatCard icon={FileWarning} label="Alertes HIGH" value={high} color="#d29922" />
        <StatCard icon={Activity} label="Logs / dernière heure" value="12 847" color="#58a6ff" trend="+18% vs hier" />
        <StatCard icon={Clock} label="Incidents ouverts" value={open} color="#8b5cf6" />
      </div>

      <div className="dashboard-grid">
        <div className="card chart-card">
          <h3>Volume de logs — 24 dernières heures</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={LOG_VOLUME_24H}>
              <defs>
                <linearGradient id="logGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#58a6ff" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#58a6ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="hour" stroke="#6e7681" fontSize={12} />
              <YAxis stroke="#6e7681" fontSize={12} />
              <Tooltip
                contentStyle={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8 }}
                labelStyle={{ color: '#8b949e' }}
              />
              <Area type="monotone" dataKey="volume" stroke="#58a6ff" fill="url(#logGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card alerts-feed">
          <div className="card-header">
            <h3>Dernières alertes</h3>
            <Link to="/alertes" className="link-sm">Voir tout →</Link>
          </div>
          <ul className="alert-list">
            {recentAlerts.map((inc) => (
              <li key={inc.id} className="alert-list-item">
                <SeverityBadge severity={inc.severity} size="sm" />
                <div className="alert-list-content">
                  <strong>{inc.title}</strong>
                  <span>{inc.createdAt}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <h3>Top 5 — IP sources les plus actives</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Adresse IP</th>
                <th>Événements</th>
                <th>Pays</th>
                <th>Niveau de risque</th>
              </tr>
            </thead>
            <tbody>
              {TOP_SOURCE_IPS.map((row, i) => (
                <tr key={row.ip}>
                  <td>{i + 1}</td>
                  <td><code className="pivot-link">{row.ip}</code></td>
                  <td>{row.events.toLocaleString('fr-FR')}</td>
                  <td>{row.country}</td>
                  <td>
                    <span className={`risk-dot risk-${row.risk}`}>{row.risk}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
