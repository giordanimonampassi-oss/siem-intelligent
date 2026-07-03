import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { login, verifyMfa, setupMfa, confirmMfa } from '../api/auth.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [authView,    setAuthView]    = useState('login')
  const [tempToken,   setTempToken]   = useState(null)

  // Chargement initial
  useEffect(() => {
    const token = localStorage.getItem('siem_token')
    const savedUser = localStorage.getItem('siem_user')

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser))
        setAuthView('app')
      } catch (e) {
        localStorage.clear()
      }
    }
    setLoading(false)
  }, [])

  // ── Login Étape 1 ─────────────────────────────────────
  const loginStep1 = useCallback(async (email, password) => {
    try {
      const data = await login(email, password)

      const token = data.access_token

      if (!data.mfa_required) {
        // Pas de MFA requis (Admin ou compte sans MFA)
        _finalizeLogin(token, data.user)
        return { step: 'done' }
      }

      // MFA requis
      setTempToken(token)
      setAuthView('mfa')
      return { step: 'mfa' }

    } catch (err) {
      console.error("Login Step 1 Error:", err.response?.data || err)
      throw err
    }
  }, [])

  // ── Login Étape 2 (MFA Verify) ───────────────────────
  const loginStep2 = useCallback(async (code) => {
    try {
      const data = await verifyMfa(code)
      _finalizeLogin(data.access_token, data.user)
      setTempToken(null)
      return data
    } catch (err) {
      console.error("MFA Step 2 Error:", err.response?.data || err)
      throw err
    }
  }, [])

  // ── Setup MFA ─────────────────────────────────────────
  const initMfaSetup = useCallback(async () => {
    return await setupMfa()
  }, [])

  const completeMfaSetup = useCallback(async (code) => {
    try {
      const data = await confirmMfa(code)
      _finalizeLogin(data.access_token, data.user)
      setTempToken(null)
      return data
    } catch (err) {
      console.error("MFA Setup Error:", err.response?.data || err)
      throw err
    }
  }, [])

  // ── Finalisation ──────────────────────────────────────
  const _finalizeLogin = (token, userData) => {
    localStorage.setItem('siem_token', token)
    localStorage.setItem('siem_user', JSON.stringify(userData))
    setUser(userData)
    setAuthView('app')
  }

  // ── Déconnexion ───────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('siem_token')
    localStorage.removeItem('siem_user')
    setUser(null)
    setTempToken(null)
    setAuthView('login')
  }, [])

  const value = {
    user,
    loading,
    authView,
    setAuthView,
    loginStep1,
    loginStep2,
    initMfaSetup,
    completeMfaSetup,
    logout,
    isAdmin: user?.role === 'ADMIN',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}