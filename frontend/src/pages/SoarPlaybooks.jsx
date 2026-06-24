export function SoarPlaybooks() {
  const telemetry = [
    ['14:32:01', 'CRITIQUE', 'Mouvement latéral détecté : 192.168.1.14 -> DB-PROD-01'],
    ['14:31:58', 'AVERTISSEMENT', "Exécution PowerShell inattendue par l'utilisateur : 'SVC_REPLICA'"],
    ['14:31:55', 'INFO', "Playbook 'ISOLATE_SUBNET_VLAN20' initié par le système"],
    ['14:31:50', 'CRITIQUE', 'Tentative d’exfiltration bloquée à la passerelle : 14,2 Go signalés'],
    ['14:31:48', 'INFO', 'Tentative d’authentification depuis une IP blacklistée bloquée'],
  ]

  return (
    <section className="page crisis-room">
      <div className="crisis-head">
        <h1>Incident actif - critique</h1>
        <code>00:14:32</code>
        <button type="button" className="secondary-button">
          Quitter la cellule de crise
        </button>
      </div>

      <div className="metric-grid">
        <article className="metric-card critical">
          <span>Alertes critiques actives</span>
          <strong>42</strong>
        </article>
        <article className="metric-card warning">
          <span>Playbooks en cours</span>
          <strong>07</strong>
        </article>
        <article className="metric-card critical">
          <span>Systèmes compromis</span>
          <strong>03</strong>
        </article>
      </div>

      <div className="crisis-grid">
        <section className="terminal-panel">
          <h2>Flux de télémétrie en temps réel...</h2>
          {telemetry.map(([time, level, message]) => (
            <p key={`${time}-${message}`}>
              <span>[{time}]</span> <strong className={level === 'CRITIQUE' ? 'critical' : level === 'AVERTISSEMENT' ? 'warning' : 'info'}>{level}</strong>{' '}
              {message}
            </p>
          ))}
        </section>

        <aside className="panel playbook-progress">
          <h2>Playbook actif</h2>
          <p>Réponse à incident : confinement ransomware</p>
          <ol className="timeline">
            <li>
              <span>Terminé</span>
              Identifier le compte et l'IP source
            </li>
            <li>
              <span>Terminé</span>
              Désactiver le compte utilisateur
            </li>
            <li>
              <span>En cours</span>
              Isoler les terminaux compromis
            </li>
            <li className="muted">
              <span>En file</span>
              Lancer la capture d’image forensique
            </li>
          </ol>
          <button type="button" className="danger-action full-width">
            Isoler tous les hôtes
          </button>
        </aside>
      </div>
    </section>
  )
}
