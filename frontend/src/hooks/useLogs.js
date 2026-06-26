/**
 * Hook useLogs — recherche et ingestion de logs depuis le backend.
 */
import { useState, useCallback } from 'react'
import * as logsApi from '../api/logs'

export function useLogs() {
  const [results, setResults]   = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const search = useCallback(async (params = {}) => {
    setLoading(true)
    setError(null)
    try {
      const data = await logsApi.searchLogs(params)
      setResults(data.results || [])
      setTotal(data.total || 0)
      return data
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur de recherche')
      return { results: [], total: 0 }
    } finally {
      setLoading(false)
    }
  }, [])

  const flag = useCallback(async (logId, isSuspicious, note) => {
    try {
      const updated = await logsApi.flagLog(logId, isSuspicious, note)
      setResults(prev =>
        prev.map(r => r.id === logId ? { ...r, ...updated } : r)
      )
      return updated
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur marquage')
      throw err
    }
  }, [])

  return { results, total, loading, error, search, flag }
}