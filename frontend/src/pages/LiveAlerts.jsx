import { liveAlerts } from '../data/mockData'
import { severityClass } from '../utils/severityClass'

export function LiveAlerts({ onNavigate }) {
  return (
    <section className="page">
      <div className="filter-bar">
        <label>
          Sévérité
          <select>
            <option>Toutes les sévérités</option>
            <option>Critique</option>
            <option>Élevée</option>
          </select>
        </label>
        <label>
          Statut
          <select>
            <option>Alertes ouvertes</option>
            <option>En investigation</option>
          </select>
        </label>
        <label>
          IP source
          <input placeholder="192.168.0.1..." />
        </label>
        <button type="button" className="primary-button">
          Appliquer
        </button>
      </div>

      <article className="alert-feature">
        <h1>Force brute SSH détectée - T1110</h1>
        <p>
          Plusieurs tentatives d'authentification échouées ont été détectées
          depuis une IP de botnet connue ciblant le cluster de production.
        </p>
        <div className="field-grid">
          <span>
            <small>IP source</small>
            103.255.42.12
          </span>
          <span>
            <small>Hôte cible</small>
            prod-db-master-01
          </span>
          <span>
            <small>Origine utilisateur</small>
            Indéfinie / root
          </span>
        </div>
        <div className="alert-actions">
          <button
            type="button"
            className="accent-button"
            onClick={() => onNavigate('incidents')}
          >
            Investiguer
          </button>
          <button type="button" className="secondary-button">
            Lancer le playbook
          </button>
          <button type="button" className="ghost-button">
            Ignorer
          </button>
          <span className="confidence">87% de confiance</span>
        </div>
      </article>

      <div className="alert-list">
        {liveAlerts.map((alert) => (
          <article className="panel alert-card" key={alert.id}>
            <div className="alert-card-head">
              <span className={`badge ${severityClass(alert.severity)}`}>
                {alert.severity}
              </span>
              <span>{alert.technique}</span>
              <span>{alert.id}</span>
            </div>
            <h2>{alert.title}</h2>
            <p>{alert.description}</p>
            <div className="field-grid">
              {alert.fields.map(([label, value]) => (
                <span key={label}>
                  <small>{label}</small>
                  {value}
                </span>
              ))}
            </div>
            <div className="alert-actions">
              <button type="button" className="accent-button">
                Investiguer
              </button>
              <button type="button" className="secondary-button">
                Lancer le playbook
              </button>
              <button type="button" className="ghost-button">
                Ignorer
              </button>
              <span className="confidence">{alert.confidence}% de confiance</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
