/**
 * Hook useHealth — interroge /health et /logs/health toutes les 30s.
 */
import { useState, useEffect } from 'react'
import client from '../api/client'
import { getLogsHealth } from '../api/logs'

export function useHealth() {
  const [health, setHealth] = useState({
    api:           'checking',
    postgresql:    'checking',
    elasticsearch: 'checking',
  })

  async function check() {
    try {
      await client.get('/health', { baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })
      const db = await getLogsHealth()
      setHealth({
        api:           'ok',
        postgresql:    db.postgresql,
        elasticsearch: db.elasticsearch,
      })
    } catch {
      setHealth(prev => ({ ...prev, api: 'error' }))
    }
  }

  useEffect(() => {
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [])

  const allOk = Object.values(health).every(v => v === 'ok')
  return { health, allOk }
}