/**
 * API Dashboard + Incidents + UEBA
 * Version adaptée à la Swagger actuelle
 */

import client from './client.js'

// ── Alertes (Module 3) ───────────────────────────────────────────────────────
// NB : ceci est un client REST (pas un hook React). Le hook useAlerts()
// dans src/hooks/useAlerts.js consomme cet objet, il ne le redéfinit pas.
export const alertsAPI = {
  list: (params = {}) =>
    client.get('/alerts', { params }),

  getStats: () =>
    client.get('/alerts/stats'),

  get: (alertId) =>
    client.get(`/alerts/${alertId}`),

  acknowledge: (alertId) =>
    client.post(`/alerts/${alertId}/acknowledge`),

  resolve: (alertId) =>
    client.post(`/alerts/${alertId}/resolve`),

  triggerSoar: (alertId) =>
    client.post(`/alerts/${alertId}/trigger-soar`),

  getExecutions: (alertId) =>
    client.get(`/alerts/${alertId}/executions`),

  confirmExecution: (execId) =>
    client.post(`/alerts/executions/${execId}/confirm`),

  cancelExecution: (execId) =>
    client.post(`/alerts/executions/${execId}/cancel`),
  getTopRules: (days = 7, limit = 5) =>
  client.get('/alerts/top-rules', { params: { days, limit } }),

  getRSSIMetrics: (days = 7) =>
  client.get('/alerts/rssi-metrics', { params: { days } }),
}

// ── Dashboard ────────────────────────────────────────────────────────────────

/** KPIs principaux pour le dashboard */
export async function getDashboardMetrics() {
  try {
    const [logsHealth, recentLogs] = await Promise.all([
      client.get('/logs/health'),           // ← existe
      client.get('/logs', { 
        params: { page: 1, size: 100, engine: 'pg' } 
      }),
    ])

    const logs = recentLogs.data.results || recentLogs.data || []
    const total = recentLogs.data.total || logs.length

    const critical = logs.filter(l => l.severity?.toUpperCase() === 'CRITICAL').length
    const high     = logs.filter(l => l.severity?.toUpperCase() === 'HIGH').length
    const warning  = logs.filter(l => l.severity?.toUpperCase() === 'WARNING').length

    // Distribution par type
    const byType = {}
    logs.forEach(l => {
      const type = l.log_type || 'unknown'
      byType[type] = (byType[type] || 0) + 1
    })

    // Top IPs sources
    const ipCount = {}
    logs.forEach(l => {
      if (l.source_ip) {
        ipCount[l.source_ip] = (ipCount[l.source_ip] || 0) + 1
      }
    })
    const topIps = Object.entries(ipCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([ip, count]) => ({ ip, count }))

    return {
      total,
      critical,
      high,
      warning,
      byType,
      topIps,
      health: logsHealth.data,
      logs: logs.slice(0, 8),
    }
  } catch (error) {
    console.error("Erreur getDashboardMetrics:", error)
    throw error
  }
}
// ── Incidents ─────────────────────────────────────────────────────────────
export const incidentsAPI = {
  list: (params = {}) =>
    client.get('/incidents', { params }),
 
  get: (id) =>
    client.get(`/incidents/${id}`),
 
  create: (data) =>
    client.post('/incidents', data),
 
  update: (id, data) =>
    client.patch(`/incidents/${id}`, data),
 
  resolve: (id) =>
    client.patch(`/incidents/${id}`, { status: 'RESOLVED' }),
}


/** Logs récents pour la vue Analyste */
export async function getRecentLogs(size = 8) {
  const { data } = await client.get('/logs', {
    params: { page: 1, size, engine: 'pg' },
  })
  return data.results || data || []
}

/** Flux temps réel (derniers logs critiques) */
export async function getLiveFeed(size = 10) {
  const { data } = await client.get('/logs', {
    params: { page: 1, size, engine: 'es' },
  })
  return data.results || data || []
}

// ── Incidents / Logs suspects ───────────────────────────────────────────────

export async function getSuspiciousLogs(page = 1, size = 20) {
  const { data } = await client.get('/logs', {
    params: { 
      page, 
      size, 
      engine: 'pg', 
      is_suspicious: true   // ou keyword: 'suspicious' selon ton implémentation
    },
  })
  return data
}

export async function getIncidentLogs(filter = 'all', page = 1) {
  const params = { page, size: 20, engine: 'pg' }
  
  if (filter === 'critical') params.severity = 'CRITICAL'
  if (filter === 'high')     params.severity = 'HIGH'
  if (filter === 'warning')  params.severity = 'WARNING'

  const { data } = await client.get('/logs', { params })
  return data
}

// ── UEBA ─────────────────────────────────────────────────────────────────────

export async function getUebaUsers() {
  const { data } = await client.get('/auth/users')
  return data
}

export async function getUserActivity(username, size = 50) {
  const { data } = await client.get('/logs', {
    params: { username, size, engine: 'es', page: 1 },
  })
  return data.results || data || []
}

export async function getBatchIntegrity(batchId) {
  const { data } = await client.get(`/logs/integrity/${batchId}`)
  return data
}

// ── Rapports ──────────────────────────────────────────────────────────────
export const reportsAPI = {
  list: (params = {}) =>
    client.get('/reports', { params }),
 
  generate: (type, period, dateFrom, dateTo) =>
    client.post('/reports/generate', {
      type, period, date_from: dateFrom, date_to: dateTo,
    }),
 
  download: (id) =>
    client.get(`/reports/${id}/download`, { responseType: 'blob' }),
 
  getIntegrityBatches: (params = {}) =>
    client.get('/reports/integrity', { params }),
}
 
// ── Infrastructure ────────────────────────────────────────────────────────
export const infraAPI = {
  listNodes: () =>
    client.get('/infrastructure'),
 
  addNode: (data) =>
    client.post('/infrastructure', data),
 
  updateNode: (id, data) =>
    client.patch(`/infrastructure/${id}`, data),
 
  removeNode: (id) =>
    client.delete(`/infrastructure/${id}`),
}

// ── Playbooks SOAR ────────────────────────────────────────────────────────
// IMPORTANT : il n'existe pas de route backend listant TOUTES les exécutions
// SOAR globalement — /alerts.py n'expose que des routes par alerte
// (GET /alerts/{id}/executions). On émule donc "toutes les exécutions
// récentes" en interrogeant les alertes CRITICAL/HIGH les plus récentes,
// puis en agrégeant leurs exécutions. Coûteux en requêtes, mais c'est la
// seule option tant qu'aucune route globale n'existe côté backend.
export const playbooksAPI = {
  // Déclenche les playbooks pour UNE alerte (route réelle)
  trigger: (alertId) =>
    client.post(`/alerts/${alertId}/trigger-soar`),

  // Exécutions d'UNE alerte (route réelle)
  getExecutionsForAlert: (alertId) =>
    client.get(`/alerts/${alertId}/executions`),

  confirm: (executionId) =>
    client.post(`/alerts/executions/${executionId}/confirm`),

  cancel: (executionId) =>
    client.post(`/alerts/executions/${executionId}/cancel`),

  // Agrégation "toutes les exécutions récentes" (pas de route dédiée)
  getExecutions: async ({ size = 10, status = null } = {}) => {
    const { data: alertsPage } = await client.get('/alerts', {
      params: { severity: 'CRITICAL', size: 20 },
    })
    const alerts = alertsPage.results || []
    const perAlert = await Promise.all(
      alerts.map((a) =>
        client.get(`/alerts/${a.id}/executions`).then(
          (r) => r.data || [],
          () => [],
        ),
      ),
    )
    let all = perAlert.flat()
    if (status) all = all.filter((e) => e.status === status)
    return { data: all.slice(0, size) }
  },
}
 
// ── UEBA ──────────────────────────────────────────────────────────────────
export const uebaAPI = {
  listProfiles: (params = {}) =>
    client.get('/ueba/profiles', { params }),
 
  getProfile: (entityId) =>
    client.get(`/ueba/profiles/${entityId}`),
 
  getAnomalies: (entityId, params = {}) =>
    client.get(`/ueba/profiles/${entityId}/anomalies`, { params }),
 
  getScoreHistory: (entityId, days = 30) =>
    client.get(`/ueba/profiles/${entityId}/history`, {
      params: { days },
    }),
 
  runBootstrap: () =>
    client.post('/ueba/bootstrap'),
}
 
// ── Règles de corrélation ─────────────────────────────────────────────────
export const rulesAPI = {
  list: (params = {}) =>
    client.get('/rules', { params }),

  get: (id) =>
    client.get(`/rules/${id}`),

  create: (data) =>
    client.post('/rules', data),

  update: (id, data) =>
    client.patch(`/rules/${id}`, data),

  // Route réelle : POST /rules/{id}/toggle (pas de PATCH)
  toggle: (id) =>
    client.post(`/rules/${id}/toggle`),

  delete: (id) =>
    client.delete(`/rules/${id}`),

  seedMitre: () =>
    client.post('/rules/seed-mitre'),
}

// ── Blocage IP (Module 3 — SOAR manuel) ──────────────────────────────────
export const firewallAPI = {
  listBlocked: (params = {}) =>
    client.get('/firewall/blocked-ips', { params }),

  blockIp: (ip_address, reason) =>
    client.post('/firewall/blocked-ips', { ip_address, reason }),

  unblockIp: (ip_address) =>
    client.post(`/firewall/blocked-ips/${ip_address}/unblock`),
}

// Health global (root)
export async function getSystemHealth() {
  const { data } = await client.get('/health')   // existe selon Swagger
  return data
}


