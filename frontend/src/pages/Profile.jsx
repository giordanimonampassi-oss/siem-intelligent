export function Profile() {
  const permissions = [
    ['Rôle principal', 'Analyste N2'],
    ['Périmètre', 'SOC / Infrastructure / Production'],
    ['Accès données', 'Logs, alertes, incidents, UEBA'],
    ['Validation SOAR', 'Mode confirmation sur comptes internes'],
  ]

  const activities = [
    ['14:22:10', 'Connexion validée avec MFA'],
    ['14:18:44', "Consultation de l'alerte AL-94285"],
    ['14:12:03', "Export CSV préparé pour l'investigation INC-0047"],
    ['13:57:29', 'Marquage d’un événement comme suspect'],
  ]

  return (
    <section className="page profile-page">
      <div className="profile-hero panel">
        <div className="profile-avatar">A4</div>
        <div>
          <h1>Analyste_04</h1>
          <p>Opérateur SOC niveau 2 - Surveillance, investigation et réponse initiale.</p>
          <div className="profile-tags">
            <span>MFA activée</span>
            <span>Session sécurisée</span>
            <span>Dernière connexion : 14:22</span>
          </div>
        </div>
        <button type="button" className="primary-button">
          Modifier le profil
        </button>
      </div>

      <div className="profile-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Informations personnelles</h2>
          </div>
          <div className="profile-kv">
            <span>Nom complet</span>
            <strong>Alex Sokolov</strong>
            <span>Email</span>
            <strong>alex.s@siem.internal</strong>
            <span>Équipe</span>
            <strong>Centre Opérationnel de Sécurité</strong>
            <span>Fuseau horaire</span>
            <strong>Africa/Lagos</strong>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Sécurité du compte</h2>
          </div>
          <div className="security-score">
            <strong>92%</strong>
            <span>Niveau de sécurité</span>
          </div>
          <div className="switch-row">
            Authentification MFA
            <input type="checkbox" defaultChecked />
          </div>
          <div className="switch-row">
            Alertes de connexion
            <input type="checkbox" defaultChecked />
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Droits et périmètre RBAC</h2>
          </div>
          <div className="profile-permissions">
            {permissions.map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Activité récente</h2>
          </div>
          <ol className="timeline">
            {activities.map(([time, text]) => (
              <li key={`${time}-${text}`}>
                <span>{time}</span>
                {text}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  )
}
