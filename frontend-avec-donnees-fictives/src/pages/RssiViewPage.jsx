import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import MainLayout from '../components/MainLayout';
import { RoleBadge } from '../components/SeverityBadge';
import { useAuth } from '../context/AuthContext';
import { RSSI_KPIS, TOP_RULES_7D, INCIDENT_TREND_7D } from '../data/mockData';
import { ROLES } from '../data/users';

export default function RssiViewPage() {
  const { user } = useAuth();
  const isRestricted = user.role === ROLES.LECTEUR;

  return (
    <MainLayout
      title="Vue RSSI"
      subtitle="Indicateurs stratégiques et conformité — 7 derniers jours"
      badge={
        isRestricted ? (
          <div className="rssi-role-banner">
            <RoleBadge role={user.role} /> — Accès restreint (pas de logs bruts)
          </div>
        ) : null
      }
    >
      <div className="rssi-kpi-grid">
        <div className="kpi-card">
          <span>Incidents (7j)</span>
          <strong>{RSSI_KPIS.incidents7d}</strong>
          <em className="trend-down">{RSSI_KPIS.incidentsTrend}% vs sem. préc.</em>
        </div>
        <div className="kpi-card">
          <span>MTTR moyen</span>
          <strong>{RSSI_KPIS.mttr}</strong>
          <em className="trend-down">{RSSI_KPIS.mttrTrend}% amélioration</em>
        </div>
        <div className="kpi-card compliance">
          <span>Conformité ISO 27001</span>
          <strong>{RSSI_KPIS.complianceISO}%</strong>
          <div className="compliance-bar"><div style={{ width: `${RSSI_KPIS.complianceISO}%` }} /></div>
        </div>
        <div className="kpi-card compliance">
          <span>Conformité RGPD</span>
          <strong>{RSSI_KPIS.complianceRGPD}%</strong>
          <div className="compliance-bar rgpd"><div style={{ width: `${RSSI_KPIS.complianceRGPD}%` }} /></div>
        </div>
        <div className="kpi-card">
          <span>Règles déclenchées</span>
          <strong>{RSSI_KPIS.rulesTriggered}</strong>
        </div>
        <div className="kpi-card">
          <span>Taux faux positifs</span>
          <strong>{RSSI_KPIS.falsePositiveRate}%</strong>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card chart-card">
          <h3>Tendance incidents — 7 jours</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={INCIDENT_TREND_7D}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Legend />
              <Bar dataKey="critical" fill="#ef4444" name="Critical" radius={[4, 4, 0, 0]} />
              <Bar dataKey="high" fill="#f97316" name="High" radius={[4, 4, 0, 0]} />
              <Bar dataKey="warning" fill="#eab308" name="Warning" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Top règles déclenchées (7j)</h3>
          <ul className="rules-ranking">
            {TOP_RULES_7D.map((r, i) => (
              <li key={r.name}>
                <span className="rank">{i + 1}</span>
                <span className="rule-name">{r.name}</span>
                <span className="rule-count">{r.count}</span>
                <div className="rank-bar"><div style={{ width: `${(r.count / 47) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {isRestricted && (
        <div className="rssi-warning">
          ⚠️ En tant que <strong>Lecteur / RSSI</strong>, vous n&apos;avez pas accès aux logs bruts ni à l&apos;investigation forensique.
          Contactez un analyste SOC pour les détails techniques.
        </div>
      )}
    </MainLayout>
  );
}
