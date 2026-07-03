/**
 * Hook useAlerts — Smart SIEM
 * Consomme tous les endpoints /api/v1/alerts du Module 3.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import client from '../api/client'
// import { alertsApi } from '../api/index.js'

// ── Appels API directs ────────────────────────────────────────────────────────

export const alertsApi = {
  getStats:      ()            => client.get('/alerts/stats'),
  list:          (params = {}) => client.get('/alerts', { params }),
  get:           (id)          => client.get(`/alerts/${id}`),
  acknowledge:   (id)          => client.post(`/alerts/${id}/acknowledge`),
  resolve:       (id)          => client.post(`/alerts/${id}/resolve`),
  triggerSoar:   (id)          => client.post(`/alerts/${id}/trigger-soar`),
  getExecutions: (id)          => client.get(`/alerts/${id}/executions`),
  confirmExec:   (execId)      => client.post(`/alerts/executions/${execId}/confirm`),
  cancelExec:    (execId)      => client.post(`/alerts/executions/${execId}/cancel`),
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function useAlerts(autoRefreshMs = 30_000) {
  const [alerts,   setAlerts]   = useState([])
  const [stats,    setStats]    = useState(null)
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [filters,  setFilters]  = useState({
    severity: '', status: '', source_ip: '', username: '',
    from_dt: '', to_dt: '', page: 1, size: 50,
  })
  const intervalRef = useRef(null)

  // ── Chargement stats ──────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const { data } = await alertsApi.getStats()
      setStats(data)
    } catch (e) {
      // silencieux — les stats sont complementaires
    }
  }, [])

  // ── Chargement liste ──────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async (customFilters = null) => {
    setLoading(true)
    setError(null)
    const params = { ...filters, ...(customFilters || {}) }

    // Nettoyer les parametres vides
    Object.keys(params).forEach(k => {
      if (params[k] === '' || params[k] === null || params[k] === undefined) {
        delete params[k]
      }
    })

    try {
      const { data } = await alertsApi.list(params)
      setAlerts(data.results || [])
      setTotal(data.total   || 0)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur chargement alertes')
    } finally {
      setLoading(false)
    }
  }, [filters])

  // ── Refresh combine ───────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await Promise.all([fetchAlerts(), fetchStats()])
  }, [fetchAlerts, fetchStats])

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  useEffect(() => {
    refresh()
    if (autoRefreshMs > 0) {
      intervalRef.current = setInterval(refresh, autoRefreshMs)
    }
    return () => clearInterval(intervalRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mettre a jour les filtres et relancer ─────────────────────────────────
  const applyFilters = useCallback((newFilters) => {
    const merged = { ...filters, ...newFilters, page: 1 }
    setFilters(merged)
    fetchAlerts(merged)
  }, [filters, fetchAlerts])

  const nextPage = useCallback(() => {
    const next = { ...filters, page: filters.page + 1 }
    setFilters(next)
    fetchAlerts(next)
  }, [filters, fetchAlerts])

  const prevPage = useCallback(() => {
    if (filters.page <= 1) return
    const prev = { ...filters, page: filters.page - 1 }
    setFilters(prev)
    fetchAlerts(prev)
  }, [filters, fetchAlerts])

  // ── Actions sur une alerte ────────────────────────────────────────────────

  const acknowledge = useCallback(async (alertId) => {
    try {
      const { data } = await alertsApi.acknowledge(alertId)
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, ...data } : a))
      if (stats) setStats(prev => ({ ...prev }))
      return data
    } catch (e) {
      throw new Error(e.response?.data?.detail || 'Erreur acknowledge')
    }
  }, [stats])

  const resolve = useCallback(async (alertId) => {
    try {
      const { data } = await alertsApi.resolve(alertId)
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, ...data } : a))
      return data
    } catch (e) {
      throw new Error(e.response?.data?.detail || 'Erreur resolve')
    }
  }, [])

  const triggerSoar = useCallback(async (alertId) => {
    try {
      const { data } = await alertsApi.triggerSoar(alertId)
      return data
    } catch (e) {
      throw new Error(e.response?.data?.detail || 'Erreur SOAR')
    }
  }, [])

  const getExecutions = useCallback(async (alertId) => {
    try {
      const { data } = await alertsApi.getExecutions(alertId)
      return data
    } catch (e) {
      return []
    }
  }, [])

  const confirmExec = useCallback(async (execId) => {
    try {
      const { data } = await alertsApi.confirmExec(execId)
      return data
    } catch (e) {
      throw new Error(e.response?.data?.detail || 'Erreur confirmation')
    }
  }, [])

  const cancelExec = useCallback(async (execId) => {
    try {
      const { data } = await alertsApi.cancelExec(execId)
      return data
    } catch (e) {
      throw new Error(e.response?.data?.detail || 'Erreur annulation')
    }
  }, [])

  // ── Computed ──────────────────────────────────────────────────────────────
  // NB : clés alignées en MAJUSCULES pour matcher la convention utilisée
  // partout ailleurs dans l'app (AlertsPage, CrisisRoomPage, Badge...).
  // Si `console.log(stats)` révèle une casse différente côté backend,
  // ajustez ici en conséquence.
  const criticalCount = stats?.by_severity?.CRITICAL || 0
  const warningCount  = stats?.by_severity?.WARNING  || 0
  const newCount      = stats?.by_status?.NEW        || 0
  const totalPages    = Math.max(1, Math.ceil(total / filters.size))

  return {
    // Donnees
    alerts, stats, total, loading, error, filters,
    criticalCount, warningCount, newCount, totalPages,

    // Navigation et filtres
    refresh, applyFilters, nextPage, prevPage,

    // Actions alertes
    acknowledge, resolve, triggerSoar,
    getExecutions, confirmExec, cancelExec,
  }
}

// ── Hook pour une alerte individuelle ─────────────────────────────────────────

export function useAlert(alertId) {
  const [alert,      setAlert]      = useState(null)
  const [executions, setExecutions] = useState([])
  const [loading,    setLoading]    = useState(false)
  const [countdown,  setCountdown]  = useState(null)
  const intervalRef = useRef(null)

  const fetch = useCallback(async () => {
    if (!alertId) return
    setLoading(true)
    try {
      const [alertRes, execRes] = await Promise.all([
        alertsApi.get(alertId),
        alertsApi.getExecutions(alertId),
      ])
      setAlert(alertRes.data)
      setExecutions(execRes.data || [])

      // Trouver le playbook en attente de confirmation
      // NB : 'pending' en MINUSCULES — PlaybookStatus.PENDING = "pending"
      // côté backend (core/constants.py). Contrairement à AlertStatus/
      // AlertSeverity qui sont en majuscules, PlaybookStatus/PlaybookMode/
      // PlaybookType sont en minuscules.
      const pending = (execRes.data || []).find(
        e => e.status === 'pending' && e.confirm_deadline
      )
      if (pending?.confirm_deadline) {
        const deadline = new Date(pending.confirm_deadline).getTime()
        const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000))
        setCountdown(remaining)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [alertId])

  useEffect(() => {
    fetch()
  }, [alertId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Decompte temps reel pour playbook CONFIRM
  useEffect(() => {
    if (countdown === null || countdown <= 0) return
    intervalRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(intervalRef.current); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [countdown])

  const confirm = useCallback(async (execId) => {
    const { data } = await alertsApi.confirmExec(execId)
    setExecutions(prev => prev.map(e => e.id === execId ? data : e))
    setCountdown(null)
    return data
  }, [])

  const cancel = useCallback(async (execId) => {
    const { data } = await alertsApi.cancelExec(execId)
    setExecutions(prev => prev.map(e => e.id === execId ? data : e))
    setCountdown(null)
    return data
  }, [])

  const resolve = useCallback(async () => {
    const { data } = await alertsApi.resolve(alertId)
    setAlert(data)
    return data
  }, [alertId])

  const acknowledge = useCallback(async () => {
    const { data } = await alertsApi.acknowledge(alertId)
    setAlert(data)
    return data
  }, [alertId])

  const triggerSoar = useCallback(async () => {
    const { data } = await alertsApi.triggerSoar(alertId)
    await fetch() // Recharger les executions
    return data
  }, [alertId, fetch])

  return {
    alert, executions, loading, countdown,
    refresh: fetch, resolve, acknowledge, triggerSoar, confirm, cancel,
  }
}
// ── Hook useModal ───────────────────────────────────────────────────────────
export function useModal(initial = false) {
  const [isOpen, setIsOpen] = useState(initial)
  const [data,   setData]   = useState(null)

  const open  = useCallback((d = null) => { setData(d); setIsOpen(true) }, [])
  const close = useCallback(() => { setIsOpen(false); setTimeout(() => setData(null), 200) }, [])

  return { isOpen, data, open, close }
}

// ── Hook useConfirm ─────────────────────────────────────────────────────────
export function useConfirm() {
  const [state, setState] = useState(null)

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setState({ ...options, resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state?.resolve(true)
    setState(null)
  }, [state])

  const handleCancel = useCallback(() => {
    state?.resolve(false)
    setState(null)
  }, [state])

  return { confirm, state, handleConfirm, handleCancel }
}