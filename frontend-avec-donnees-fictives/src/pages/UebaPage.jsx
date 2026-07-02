import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import MainLayout from '../components/MainLayout';
import { UEBA_ENTITIES, UEBA_PROFILE } from '../data/mockData';

function RiskGauge({ score }) {
  const color = score >= 70 ? '#ef4444' : score >= 40 ? '#f97316' : '#22c55e';
  return (
    <div className="risk-gauge">
      <svg viewBox="0 0 120 70" className="gauge-svg">
        <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="#1e293b" strokeWidth="10" />
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${(score / 100) * 157} 157`}
        />
      </svg>
      <div className="gauge-value" style={{ color }}>
        <strong>{score}</strong>
        <span>/ 100</span>
      </div>
    </div>
  );
}

export default function UebaPage() {
  const [selectedEntity, setSelectedEntity] = useState('n.myers');
  const profile = selectedEntity === 'n.myers' ? UEBA_PROFILE : {
    ...UEBA_PROFILE,
    entity: selectedEntity,
    name: UEBA_ENTITIES.find((e) => e.id === selectedEntity)?.name || selectedEntity,
    riskScore: UEBA_ENTITIES.find((e) => e.id === selectedEntity)?.riskScore || 30,
    anomalies: UEBA_PROFILE.anomalies.slice(0, 1),
  };

  return (
    <MainLayout
      title="Profil UEBA"
      subtitle="Analyse comportementale par entité (EF-UEB-01/04)"
    >
      <div className="ueba-layout">
        <div className="card entity-list">
          <h3>Entités surveillées</h3>
          <ul>
            {UEBA_ENTITIES.map((e) => (
              <li
                key={e.id}
                className={selectedEntity === e.id ? 'active' : ''}
                onClick={() => setSelectedEntity(e.id)}
              >
                <div>
                  <strong>{e.name}</strong>
                  <span>{e.type} · {e.department}</span>
                </div>
                <span className={`risk-score risk-${e.riskScore >= 70 ? 'high' : e.riskScore >= 40 ? 'medium' : 'low'}`}>
                  {e.riskScore}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="ueba-detail">
          <div className="card ueba-header-card">
            <div>
              <h2>{profile.name}</h2>
              <span className="entity-type">{profile.type}</span>
            </div>
            <RiskGauge score={profile.riskScore} />
          </div>

          <div className="dashboard-grid">
            <div className="card">
              <h3>Baseline comportementale (30 jours)</h3>
              <dl className="baseline-dl">
                <div><dt>Horaires habituels</dt><dd>{profile.baseline.usualHours}</dd></div>
                <div><dt>Connexions moy.</dt><dd>{profile.baseline.avgLogins}</dd></div>
                <div><dt>Volume données</dt><dd>{profile.baseline.avgDataVolume}</dd></div>
                <div><dt>Clearance</dt><dd>{profile.baseline.clearance}</dd></div>
              </dl>
              <div className="usual-resources">
                <span>Ressources habituelles :</span>
                {profile.baseline.usualResources.map((r) => (
                  <code key={r}>{r}</code>
                ))}
              </div>
            </div>

            <div className="card chart-card">
              <h3>Évolution score de risque</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={profile.scoreHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="day" stroke="#64748b" />
                  <YAxis domain={[0, 100]} stroke="#64748b" />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                  <Line type="monotone" dataKey="score" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3>Anomalies détectées récemment</h3>
            <div className="anomaly-list">
              {profile.anomalies.map((a, i) => (
                <div key={i} className="anomaly-item">
                  <time>{a.date}</time>
                  <div>
                    <strong>{a.type}</strong>
                    <p>{a.detail}</p>
                  </div>
                  <span className="score-impact">{a.scoreImpact}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
