/**
 * Client HTTP centralisé — Smart SIEM
 * Gère automatiquement : JWT Bearer, refresh, erreurs globales.
 */
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const client = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Injecter le token JWT sur chaque requête ─────────────────────────────────
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('siem_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Gérer les erreurs globalement ────────────────────────────────────────────
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expiré → déconnexion automatique
      localStorage.removeItem('siem_token')
      localStorage.removeItem('siem_user')
      window.dispatchEvent(new Event('siem:logout'))
    }
    return Promise.reject(error)
  },
)

export default client