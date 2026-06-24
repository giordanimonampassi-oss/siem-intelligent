import { incidents, playbooks } from '../data/mockData'

export function Incidents() {
  return (
    <section className="page incident-layout">
      <aside className="incident-list">
        <div className="segmented">
          <button type="button" className="active">
            Tous
          </button>
          <button type="button">Ouverts</button>
          <button type="button">Actifs</button>
          <button type="button">Résolus</button>
        </div>
        {incidents.map((incident, index) => (
          <article className={`incident-item ${index === 0 ? 'active' : ''}`} key={incident.id}>
            <span>{incident.id}</span>
            <strong>{incident.title}</strong>
            <p>{incident.description}</p>
            <small>{incident.age}</small>
            <em>{incident.severity}</em>
          </article>
        ))}
      </aside>

      <div className="incident-detail">
        <div className="incident-title">
          <div>
            <span>#INC-0047</span>
            <h1>Tentative de collecte d'identifiants - HR-VPC-EAST</h1>
            <p>Première détection : 23 juin 2026 - 14:22:11 UTC</p>
          </div>
          <button type="button" className="secondary-button">
            M'assigner
          </button>
          <button type="button" className="primary-button">
            Résoudre l'incident
          </button>
        </div>

        <div className="field-grid incident-fields">
          <span>
            <small>MITRE ATT&CK</small>
            T1110.003: Brute Force
          </span>
          <span>
            <small>IP source</small>
            185.220.101.42 (TOR)
          </span>
          <span>
            <small>Compte cible</small>
            svc-hr-payroll
          </span>
          <span>
            <small>Périmètre d'impact</small>
            {' '}
            3 actifs, 1 utilisateur
          </span>
        </div>

        <div className="incident-columns">
          <section>
            <h2>Chronologie des événements</h2>
            <ol className="timeline">
              <li>
                <span>14:22:11</span>
                Accès initial via VPN compromis
              </li>
              <li>
                <span>14:23:45</span>
                Tentative de mouvement latéral
              </li>
              <li>
                <span>14:25:02</span>
                Confinement automatique déclenché
              </li>
            </ol>
          </section>

          <section>
            <h2>Playbooks SOAR</h2>
            {playbooks.map(([name, status, meta]) => (
              <article className="playbook-card" key={name}>
                <strong>{name}</strong>
                <span>{status}</span>
                <small>{meta}</small>
              </article>
            ))}
          </section>
        </div>

        <section className="panel">
          <div className="panel-header">
            <h2>Journal des actions SOAR</h2>
          </div>
          <div className="table-row table-head">
            <span>Horodatage</span>
            <span>Action</span>
            <span>Cible</span>
            <span>Système</span>
            <span>Statut</span>
          </div>
          <div className="table-row">
            <span>14:22:15</span>
            <span>Blocage IP</span>
            <span>185.220.101.42</span>
            <span>PaloAlto FW</span>
            <span className="success-text">Succès</span>
          </div>
        </section>
      </div>
    </section>
  )
}
