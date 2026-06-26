/**
 * API Dashboard + Incidents + UEBA
 * Endpoints backend pour les pages refactorisees
 */
import client from './client'

// ── Dashboard ────────────────────────────────────────────────────────────────

/** KPIs principaux : comptages par severite, logs/h, systemes */
export async function getDashboardMetrics() {
  const [logsHealth, recentLogs] = await Promise.all([
    client.get('/logs/health'),
    client.get('/logs', { params: { page: 1, size: 100, engine: 'pg' } }),
  ])

  const logs = recentLogs.data.results || []
  const total = recentLogs.data.total || 0

  const critical = logs.filter(l => l.severity === 'CRITICAL').length
  const high     = logs.filter(l => l.severity === 'HIGH').length
  const warning  = logs.filter(l => l.severity === 'WARNING').length

  // Comptage par type pour la distribution
  const byType = {}
  logs.forEach(l => { byType[l.log_type] = (byType[l.log_type] || 0) + 1 })

  // Top IPs sources
  const ipCount = {}
  logs.forEach(l => { if (l.source_ip) ipCount[l.source_ip] = (ipCount[l.source_ip] || 0) + 1 })
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
}

/** Logs recents pour la vue Analyste */
export async function getRecentLogs(size = 8) {
  const { data } = await client.get('/logs', {
    params: { page: 1, size, engine: 'pg' },
  })
  return data.results || []
}

/** Flux temps reel : derniers logs critiques/high */
export async function getLiveFeed(size = 10) {
  const { data } = await client.get('/logs', {
    params: { page: 1, size, engine: 'es' },
  })
  return data.results || []
}

// ── Incidents (via logs suspects) ────────────────────────────────────────────

/** Logs marques comme suspects = incidents potentiels */
export async function getSuspiciousLogs(page = 1, size = 20) {
  // On cherche les logs suspects via PG
  const { data } = await client.get('/logs', {
    params: { page, size, engine: 'pg', keyword: 'suspicious' },
  })
  return data
}

/** Tous les logs pour construire les "incidents" depuis les logs CRITICAL */
export async function getIncidentLogs(filter = 'all', page = 1) {
  const params = { page, size: 20, engine: 'pg' }
  if (filter === 'critical') params.severity = 'CRITICAL'
  if (filter === 'high')     params.severity = 'HIGH'
  if (filter === 'warning')  params.severity = 'WARNING'

  const { data } = await client.get('/logs', { params })
  return data
}

// ── UEBA ─────────────────────────────────────────────────────────────────────

/** Profils utilisateurs avec leur activite recente */
export async function getUebaUsers() {
  const { data } = await client.get('/auth/users')
  return data
}

/** Activite d un utilisateur : ses logs recents */
export async function getUserActivity(username, size = 50) {
  const { data } = await client.get('/logs', {
    params: { username, size, engine: 'es', page: 1 },
  })
  return data.results || []
}

/** Intégrite d un batch pour la vue audit */
export async function getBatchIntegrity(batchId) {
  const { data } = await client.get(`/logs/integrity/${batchId}`)
  return data
}