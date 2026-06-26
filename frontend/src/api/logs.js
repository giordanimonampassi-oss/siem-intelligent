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