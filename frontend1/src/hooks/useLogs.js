import { useState, useCallback } from 'react'
import { searchLogs, flagLog } from '../api/logs.js'

export function useLogs() {
  const [results,  setResults]  = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [lastParams, setLastParams] = useState({})

  const search = useCallback(async (params = {}) => {
    setLoading(true)
    setError(null)
    setLastParams(params)

    try {
      const data = await searchLogs(params)           // ← Appel direct
      setResults(data.results || data || [])
      setTotal(data.total || 0)
      return data
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.detail || 'Erreur de recherche')
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  const flag = useCallback(async (logId, isSuspicious, note = '') => {
    try {
      const data = await flagLog(logId, isSuspicious, note)
      
      // Mise à jour optimiste dans la liste
      setResults(prev =>
        prev.map(l => l.id === logId 
          ? { ...l, is_suspicious: isSuspicious, note } 
          : l
        )
      )
      return data
    } catch (err) {
      console.error(err)
      throw err
    }
  }, [])

  const refresh = useCallback(() => {
    if (Object.keys(lastParams).length > 0) {
      search(lastParams)
    }
  }, [search, lastParams])

  return { 
    results, 
    total, 
    loading, 
    error, 
    search, 
    flag, 
    refresh 
  }
}