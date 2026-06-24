import { logRows } from '../data/mockData'
import { severityClass } from '../utils/severityClass'

export function LogSearch() {
  const payload = `{
  "timestamp": "2026-06-23T14:22:01.034Z",
  "source_ip": "192.168.1.45",
  "dest_ip": "10.0.0.254",
  "event_id": 4625,
  "sub_type": "LOGON_FAILURE",
  "domain": "CORP_NET",
  "severity": "CRITICAL",
  "forensics": {
    "anomaly_detected": true,
    "brute_force_likelihood": 0.92
  }
}`

  return (
    <section className="page investigation-layout">
      <div className="logs-area">
        <div className="search-command">
          <input placeholder="Rechercher logs, IP, utilisateur, hôte, hash ou requête..." />
          <button type="button" className="primary-button">
            Rechercher
          </button>
          <button type="button" className="secondary-button">
            Exporter CSV
          </button>
          <button type="button" className="secondary-button">
            Exporter Excel
          </button>
        </div>

        <section className="panel log-table">
          <div className="table-row table-head">
            <span>Horodatage</span>
            <span>Source IP</span>
            <span>Hôte</span>
            <span>Type</span>
            <span>Sévérité</span>
          </div>
          {logRows.map((row) => (
            <div className="table-row" key={`${row[0]}-${row[1]}`}>
              {row.map((cell, index) =>
                index === 4 ? (
                  <span className={`badge ${severityClass(cell)}`} key={cell}>
                    {cell}
                  </span>
                ) : (
                  <span key={`${cell}-${index}`}>{cell}</span>
                ),
              )}
            </div>
          ))}
        </section>
      </div>

      <aside className="detail-drawer">
        <div className="drawer-head">
          <div>
            <h2>Détail de l'événement</h2>
            <code>ID: L-992834</code>
          </div>
          <button type="button" className="icon-button">
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>
        <div className="risk-box">
          <span>Score de risque</span>
          <strong>84/100</strong>
          <i></i>
        </div>
        <h3>Payload brut</h3>
        <pre>{payload}</pre>
        <label className="switch-row">
          Marquer comme suspect
          <input type="checkbox" />
        </label>
        <button type="button" className="primary-button full-width">
          Ajouter à l'investigation
        </button>
        <button type="button" className="secondary-button full-width">
          Télécharger le PCAP brut
        </button>
      </aside>
    </section>
  )
}
