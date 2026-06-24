import { useState } from 'react'
import { latestAlerts, metrics } from '../data/mockData'
import { severityClass } from '../utils/severityClass'

const dashboardViews = [
  { id: 'analyste', label: 'Analyste' },
  { id: 'rssi', label: 'RSSI' },
  { id: 'realtime', label: 'Temps réel' },
  { id: 'investigation', label: 'Investigation' },
]

const topSourceIps = ['192.168.1.142', '10.0.0.45', '172.16.5.12', '45.22.144.1']

const rssiMetrics = [
  {
    label: 'Alertes critiques',
    value: '3',
    caption: 'Niveau de risque global : élevé',
    tone: 'critical',
  },
  {
    label: 'Incidents ouverts',
    value: '7',
    caption: '2 nécessitent une escalade',
    tone: 'warning',
  },
  {
    label: 'Conformité SOC',
    value: '94%',
    caption: 'SLA de détection respecté',
    tone: 'info',
  },
]

function MetricCards({ items }) {
  return (
    <div className="metric-grid">
      {items.map((metric) => (
        <article className={`metric-card ${metric.tone}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small>{metric.caption}</small>
        </article>
      ))}
    </div>
  )
}

function LogVolumeChart() {
  return (
    <section className="panel chart-panel wide">
      <div className="panel-header">
        <h2>Volume de logs sur 24 h</h2>
        <span>Volume total / événements critiques</span>
      </div>
      <div className="line-chart" aria-label="Graphique du volume de logs">
        <span className="line line-main"></span>
        <span className="line line-danger"></span>
      </div>
    </section>
  )
}

function AlertDistribution() {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Répartition des alertes</h2>
      </div>
      <div className="donut-row">
        <div className="donut">100%</div>
        <ul className="legend">
          <li>
            <span className="dot info"></span>Authentification 35%
          </li>
          <li>
            <span className="dot accent"></span>Trafic réseau 28%
          </li>
          <li>
            <span className="dot warning"></span>Opérations système 22%
          </li>
          <li>
            <span className="dot info"></span>Applications 15%
          </li>
        </ul>
      </div>
    </section>
  )
}

function LatestAlertsPanel({ onNavigate }) {
  return (
    <section className="panel latest-alerts">
      <div className="panel-header">
        <h2>Dernières alertes</h2>
        <button
          type="button"
          className="text-button"
          onClick={() => onNavigate?.('alerts')}
        >
          Voir tous les enregistrements
        </button>
      </div>
      <div className="table">
        <div className="table-row table-head">
          <span>Sévérité</span>
          <span>Règle</span>
          <span>Source IP</span>
          <span>Horodatage</span>
          <span>Statut</span>
        </div>
        {latestAlerts.map((alert) => (
          <div className="table-row" key={`${alert.rule}-${alert.time}`}>
            <span className={`badge ${severityClass(alert.severity)}`}>
              {alert.severity}
            </span>
            <strong>{alert.rule}</strong>
            <code>{alert.source}</code>
            <span>{alert.time}</span>
            <span>{alert.status}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function TopSourceIps() {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Principales IP sources</h2>
      </div>
      {topSourceIps.map((ip, index) => (
        <div className="bar-row" key={ip}>
          <span>{ip}</span>
          <div>
            <i style={{ width: `${88 - index * 12}%` }}></i>
          </div>
        </div>
      ))}
    </section>
  )
}

function ExecutiveSummary() {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Synthèse RSSI</h2>
        <span>Vue consolidée sur 7 jours</span>
      </div>
      <div className="profile-kv">
        <span>Menaces bloquées</span>
        <strong>128</strong>
        <span>Temps moyen de détection</span>
        <strong>14,2 s</strong>
        <span>Playbooks exécutés</span>
        <strong>34</strong>
        <span>Couverture MITRE ATT&CK</span>
        <strong>12 tactiques</strong>
      </div>
    </section>
  )
}

function LiveFeed() {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Flux temps réel</h2>
        <span className="live-indicator">En direct</span>
      </div>
      <ol className="timeline">
        <li>
          <span>14:32:01</span>
          Mouvement latéral détecté — 192.168.1.14
        </li>
        <li>
          <span>14:31:58</span>
          Exécution PowerShell suspecte — SVC_REPLICA
        </li>
        <li>
          <span>14:31:55</span>
          Playbook ISOLATE_SUBNET_VLAN20 initié
        </li>
      </ol>
    </section>
  )
}

export function Dashboard({ onNavigate }) {
  const [activeView, setActiveView] = useState('analyste')

  return (
    <section className="page page-dashboard">
      <div className="dashboard-toolbar">
        <div>
          <h1>Tableau de bord</h1>
          <p>Vues adaptées par profil : analyste, RSSI, temps réel et investigation.</p>
        </div>
        <div className="segmented dashboard-views" role="tablist" aria-label="Vues du tableau de bord">
          {dashboardViews.map((view) => (
            <button
              type="button"
              key={view.id}
              role="tab"
              aria-selected={activeView === view.id}
              className={activeView === view.id ? 'active' : ''}
              onClick={() => setActiveView(view.id)}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {activeView === 'analyste' && (
        <>
          <MetricCards items={metrics} />
          <div className="dashboard-grid">
            <LogVolumeChart />
            <AlertDistribution />
            <LatestAlertsPanel onNavigate={onNavigate} />
            <TopSourceIps />
          </div>
        </>
      )}

      {activeView === 'rssi' && (
        <>
          <MetricCards items={rssiMetrics} />
          <div className="dashboard-grid compact">
            <ExecutiveSummary />
            <AlertDistribution />
          </div>
        </>
      )}

      {activeView === 'realtime' && (
        <>
          <MetricCards items={metrics} />
          <div className="dashboard-grid">
            <LiveFeed />
            <LatestAlertsPanel onNavigate={onNavigate} />
          </div>
        </>
      )}

      {activeView === 'investigation' && (
        <>
          <MetricCards items={metrics.filter((metric) => metric.tone !== 'info')} />
          <div className="dashboard-grid">
            <LatestAlertsPanel onNavigate={onNavigate} />
            <TopSourceIps />
            <LogVolumeChart />
          </div>
        </>
      )}
    </section>
  )
}
