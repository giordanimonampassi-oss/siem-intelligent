/**
 * AuthContext — état global d'authentification.
 * Fournit : user, token, isAuthenticated, login, logout, authStep.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import * as authApi from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(() => {
    try { return JSON.parse(localStorage.getItem('siem_user')) } catch { return null }
  })
  const [token, setToken]       = useState(() => localStorage.getItem('siem_token') || null)
  const [authStep, setAuthStep] = useState('idle')
  // authStep : 'idle' | 'loading' | 'mfa_required' | 'mfa_setup' | 'done' | 'error'
  const [authError, setAuthError] = useState(null)

  const isAuthenticated = !!token && !!user

  // Écoute la déconnexion forcée (token expiré — depuis intercepteur axios)
  useEffect(() => {
    const handler = () => logout()
    window.addEventListener('siem:logout', handler)
    return () => window.removeEventListener('siem:logout', handler)
  }, [])

  // ── Login étape 1 ──────────────────────────────────────────────────────────
  const loginStep1 = useCallback(async (email, password) => {
    setAuthStep('loading')
    setAuthError(null)
    try {
      const result = await authApi.login(email, password)
      // Stocker le token temporaire (sans mfa_verified si MFA requis)
      _storeToken(result.access_token)
      _storeUser(result.user)

      if (result.mfa_required) {
        setAuthStep('mfa_required')
      } else if (!result.user.mfa_enabled) {
        // Première connexion sans MFA → proposer le setup
        setAuthStep('mfa_setup')
      } else {
        setAuthStep('done')
        setUser(result.user)
        setToken(result.access_token)
      }
      return result
    } catch (err) {
      const msg = err.response?.data?.detail || 'Identifiants incorrects'
      setAuthError(msg)
      setAuthStep('error')
      throw err
    }
  }, [])

  // ── Login étape 2 (MFA) ────────────────────────────────────────────────────
  const loginStep2 = useCallback(async (code) => {
    setAuthStep('loading')
    setAuthError(null)
    try {
      const result = await authApi.verifyMfa(code)
      _storeToken(result.access_token)
      _storeUser(result.user)
      setUser(result.user)
      setToken(result.access_token)
      setAuthStep('done')
      return result
    } catch (err) {
      const msg = err.response?.data?.detail || 'Code MFA invalide'
      setAuthError(msg)
      setAuthStep('mfa_required') // Rester sur l'écran MFA
      throw err
    }
  }, [])

  // ── Setup MFA ──────────────────────────────────────────────────────────────
  const initMfaSetup = useCallback(async () => {
    return await authApi.setupMfa()
  }, [])

  const completeMfaSetup = useCallback(async (code) => {
    await authApi.confirmMfa(code)
    // Recharger le profil avec mfa_enabled=true
    const updated = await authApi.getMe()
    _storeUser(updated)
    setUser(updated)
    setAuthStep('done')
  }, [])

  const skipMfaSetup = useCallback(() => {
    setAuthStep('done')
  }, [])

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('siem_token')
    localStorage.removeItem('siem_user')
    setToken(null)
    setUser(null)
    setAuthStep('idle')
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _storeToken(t) {
    localStorage.setItem('siem_token', t)
    setToken(t)
  }
  function _storeUser(u) {
    localStorage.setItem('siem_user', JSON.stringify(u))
    setUser(u)
  }

  return (
    <AuthContext.Provider value={{
      user, token, isAuthenticated,
      authStep, authError,
      loginStep1, loginStep2,
      initMfaSetup, completeMfaSetup, skipMfaSetup,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}