/**
 * API Logs — ingestion, recherche, marquage, intégrité.
 */
import client from './client'

// ── Ingestion ─────────────────────────────────────────────────────────────────

export async function ingestLog(payload) {
  const { data } = await client.post('/logs', payload)
  return data
}

export async function ingestBatch(logs, batchId = null) {
  const { data } = await client.post('/logs/batch', {
    logs,
    batch_id: batchId,
  })
  return data
}

// ── Recherche ─────────────────────────────────────────────────────────────────

/**
 * Recherche multi-critères.
 * @param {Object} params - { source_ip, username, host, log_type, severity,
 *                            from_dt, to_dt, keyword, engine, page, size }
 */
export async function searchLogs(params = {}) {
  const { data } = await client.get('/logs', { params })
  return data // { total, page, size, results: [...] }
}

// ── Détail ────────────────────────────────────────────────────────────────────

export async function getLog(logId) {
  const { data } = await client.get(`/logs/${logId}`)
  return data
}

// ── Marquage suspect ──────────────────────────────────────────────────────────

export async function flagLog(logId, isSuspicious, note = null) {
  const { data } = await client.patch(`/logs/${logId}/flag`, {
    is_suspicious: isSuspicious,
    note,
  })
  return data
}

// ── Intégrité SHA-256 ────────────────────────────────────────────────────────

export async function verifyIntegrity(batchId) {
  const { data } = await client.get(`/logs/integrity/${batchId}`)
  return data
}

// ── Santé ─────────────────────────────────────────────────────────────────────

export async function getLogsHealth() {
  const { data } = await client.get('/logs/health')
  return data
}

// À ajouter dans logs.js

/** Statistiques calculées pour le dashboard (compatible ancienne logique) */
export async function getDashboardMetrics() {
  const [healthRes, logsRes] = await Promise.all([
    client.get('/logs/health'),
    client.get('/logs', { 
      params: { page: 1, size: 100, engine: 'pg' } 
    })
  ])

  const logs = logsRes.data.results || logsRes.data || []
  const total = logsRes.data.total || logs.length

  // Calculs côté frontend (comme dans l'ancienne version)
  const critical = logs.filter(l => l.severity === 'CRITICAL').length
  const high = logs.filter(l => l.severity === 'HIGH').length
  const warning = logs.filter(l => l.severity === 'WARNING').length

  const byType = {}
  logs.forEach(l => {
    const type = l.log_type || 'other'
    byType[type] = (byType[type] || 0) + 1
  })

  const ipCount = {}
  logs.forEach(l => {
    if (l.source_ip) ipCount[l.source_ip] = (ipCount[l.source_ip] || 0) + 1
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
    logs: logs.slice(0, 15),
    health: healthRes.data,
  }
}
export async function getLogsStats() {
  const { data } = await client.get('/logs/stats')
  return data
}