import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, ShieldAlert } from 'lucide-react';
import SeverityBadge from '../components/SeverityBadge';
import { INCIDENTS } from '../data/mockData';

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function elapsedMinutes(since) {
  const base = new Date('2026-03-25T06:14:37');
  const diff = Math.floor((Date.now() - base.getTime()) / 60000);
  return Math.max(1, diff + Math.floor(Date.now() / 1000) % 60 / 60);
}

export default function CrisisRoomPage() {
  const now = useLiveClock();
  const [logsIngested, setLogsIngested] = useState(2847591);
  const critical = INCIDENTS.filter((i) => i.severity === 'CRITICAL' && i.status !== 'résolu');
  const high = INCIDENTS.filter((i) => i.severity === 'HIGH' && i.status !== 'résolu');
  const compromised = ['srv-pentagon-01', 'ws-analyst-12', '10.0.4.22'];
  const playbooks = [
    { name: 'Isolation compte CTU-SVC-003', progress: 100, status: 'terminé' },
    { name: 'Blocage IP 178.43.12.87', progress: 85, status: 'en cours' },
  ];

  const globalStatus = critical.length > 0 ? 'crise' : high.length > 0 ? 'alerte' : 'calme';

  useEffect(() => {
    const t = setInterval(() => {
      setLogsIngested((n) => n + Math.floor(Math.random() * 120) + 40);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={`crisis-room status-${globalStatus}`}>
      <header className="crisis-header">
        <div className="crisis-brand">
          <ShieldAlert size={32} />
          <div>
            <h1>CRISIS ROOM — CTU</h1>
            <span>Vue opérationnelle temps réel · Rafraîchissement 5s</span>
          </div>
        </div>
        <div className={`global-status-bar status-${globalStatus}`}>
          {globalStatus === 'crise' && '🔴 CRISE ACTIVE'}
          {globalStatus === 'alerte' && '🟠 ALERTE ÉLEVÉE'}
          {globalStatus === 'calme' && '🟢 SITUATION CALME'}
        </div>
        <div className="crisis-clock">
          {now.toLocaleTimeString('fr-FR')} · {now.toLocaleDateString('fr-FR')}
        </div>
        <Link to="/dashboard" className="crisis-exit"><X size={20} /> Quitter</Link>
      </header>

      <div className="crisis-grid">
        <section className="crisis-zone zone-critical">
          <h2>Alertes CRITICAL — {critical.length} active(s)</h2>
          {critical.map((inc) => (
            <div key={inc.id} className="crisis-alert-card">
              <SeverityBadge severity="CRITICAL" />
              <div>
                <strong>{inc.title}</strong>
                <span className="elapsed">Actif depuis {elapsedMinutes(inc.createdAt)} min</span>
              </div>
              <code>{inc.id}</code>
            </div>
          ))}
        </section>

        <section className="crisis-zone zone-high">
          <h2>Alertes HIGH — {high.length} active(s)</h2>
          {high.map((inc) => (
            <div key={inc.id} className="crisis-alert-card">
              <SeverityBadge severity="HIGH" />
              <div>
                <strong>{inc.title}</strong>
                <span className="elapsed">Actif depuis {elapsedMinutes(inc.createdAt) + 2} min</span>
              </div>
            </div>
          ))}
        </section>

        <section className="crisis-zone zone-blue">
          <h2>Systèmes compromis & SOAR</h2>
          <div className="compromised-list">
            {compromised.map((s) => (
              <div key={s} className="compromised-item">{s}</div>
            ))}
          </div>
          <h3>Playbooks en cours</h3>
          {playbooks.map((pb) => (
            <div key={pb.name} className="playbook-progress">
              <span>{pb.name}</span>
              <div className="progress-bar"><div style={{ width: `${pb.progress}%` }} /></div>
              <span>{pb.status}</span>
            </div>
          ))}
        </section>
      </div>

      <footer className="crisis-footer">
        <div className="live-counter">
          <span className="pulse-dot" />
          Logs ingérés en direct : <strong>{logsIngested.toLocaleString('fr-FR')}</strong>
        </div>
      </footer>
    </div>
  );
}
