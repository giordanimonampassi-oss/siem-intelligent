export function UebaProfiles() {
  return (
    <section className="page">
      <div className="row g-4 align-items-start">
        <div className="col-12 col-xl-4">
          <div className="ueba-profile-column">
            <article className="panel">
              <div className="d-flex flex-column flex-sm-row align-items-start gap-3">
                <div className="avatar flex-shrink-0">JD</div>
                <div className="min-w-0">
                  <h1 className="ueba-profile-name">John Doe</h1>
                  <code className="d-block text-break">jdoe@ctu.gov</code>
                  <p className="mb-0">
                    Administrateur bases de données senior — Infrastructure & Ops
                  </p>
                </div>
              </div>

              <div className="row g-3 mt-3">
                <div className="col-12 col-sm-6">
                  <button type="button" className="primary-button w-100">
                    Audit complet
                  </button>
                </div>
                <div className="col-12 col-sm-6">
                  <button type="button" className="danger-outline w-100">
                    Isoler l'hote
                  </button>
                </div>
              </div>
            </article>

            <section className="panel risk-score">
              <span>Score de risque de l'entite</span>
              <div>78</div>
              <strong>Risque élevé</strong>
            </section>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="ueba-main">
            <section className="panel anomaly-list">
              <div className="panel-header">
                <h2>Anomalies détectées</h2>
                <span>4 non résolues</span>
              </div>
              {[
                ['Connexion hors horaires habituels', '+15'],
                ['Transfert sortant volumineux vers une IP externe', '+22'],
                ['Échecs LDAP excessifs', '+41'],
              ].map(([title, impact]) => (
                <div className="anomaly-row" key={title}>
                  <strong>{title}</strong>
                  <span>{impact} impact</span>
                </div>
              ))}
            </section>

            <div className="row g-4 mt-0 ueba-insights-grid">
              <div className="col-12 col-lg-6">
                <section className="panel h-100">
                  <h2>Heures de connexion habituelles</h2>
                  <div className="mini-bars">
                    {[8, 10, 12, 44, 16, 18, 36, 48, 58, 44, 34].map(
                      (height, index) => (
                        <i
                          style={{ height: `${height}%` }}
                          key={`${height}-${index}`}
                        ></i>
                      ),
                    )}
                  </div>
                </section>
              </div>

              <div className="col-12 col-lg-6">
                <section className="panel h-100">
                  <h2>Statistiques de reference</h2>
                  <div className="row g-3 my-4">
                    <div className="col-12 col-md-6 col-lg-12 col-xxl-6">
                      <span className="stat-card">
                        Transfert quotidien moyen
                        <strong>142 MB</strong>
                      </span>
                    </div>
                    <div className="col-12 col-md-6 col-lg-12 col-xxl-6">
                      <span className="stat-card">
                        Durée de session
                        <strong>6.2 hrs</strong>
                      </span>
                    </div>
                  </div>
                  <div className="tag-cloud">
                    <span>srv-db-prod-01</span>
                    <span>dc-core-vlan2</span>
                    <span>ssh-jump-box</span>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
