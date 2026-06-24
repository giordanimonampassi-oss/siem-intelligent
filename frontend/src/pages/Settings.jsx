import { users } from '../data/mockData'

export function Settings() {
  return (
    <section className="page">
      <div className="page-title">
        <h1>Administration système</h1>
        <p>
          Gérer les utilisateurs, règles de corrélation, rétention et politiques
          de gouvernance des données.
        </p>
      </div>

      <div className="tabs overflow-auto">
        <button type="button" className="active">
          Utilisateurs et rôles
        </button>
        <button type="button">Règles de corrélation</button>
        <button type="button">Politique de rétention</button>
        <button type="button">Journal d'audit</button>
      </div>

      <section className="panel">
        <div className="panel-header flex-column flex-md-row align-items-start align-items-md-center">
          <h2>Gestion des identités</h2>
          <button type="button" className="primary-button w-100 w-md-auto">
            Ajouter un utilisateur
          </button>
        </div>

        <div className="table-responsive">
          <table className="table siem-table align-middle mb-0">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Statut MFA</th>
                <th>Dernière connexion</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(([name, email, role, mfa, lastLogin]) => (
                <tr key={email}>
                  <td>
                    <strong>{name}</strong>
                    <small>{email}</small>
                  </td>
                  <td>
                    <span className="badge info">{role}</span>
                  </td>
                  <td>
                    <span className={mfa.startsWith('Activ') ? 'success-text' : 'alert-text'}>
                      {mfa}
                    </span>
                  </td>
                  <td>{lastLogin}</td>
                  <td>
                    <span className="row-actions justify-content-end">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Modifier ${name}`}
                      >
                        <i className="bi bi-pencil-square" aria-hidden="true"></i>
                      </button>
                      <button
                        type="button"
                        className="icon-button alert-text"
                        aria-label={`Supprimer ${name}`}
                      >
                        <i className="bi bi-trash3-fill" aria-hidden="true"></i>
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}
