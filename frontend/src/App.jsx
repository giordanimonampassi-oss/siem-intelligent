import { useEffect, useMemo, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Sidebar }          from './components/Sidebar'
import { Topbar }           from './components/Topbar'
import { AuthLoading }      from './pages/AuthLoading'
import { Dashboard }        from './pages/Dashboard'
import { LiveAlerts }       from './pages/LiveAlerts'
import { LogSearch }        from './pages/LogSearch'
import { Incidents }        from './pages/Incidents'
import { Landing }          from './pages/Landing'
import { Login }            from './pages/Login'
import { MfaVerification }  from './pages/MfaVerification'
import { MfaSetup }         from './pages/MfaSetup'
import { Register }         from './pages/Register'
import { SoarPlaybooks }    from './pages/SoarPlaybooks'
import { UebaProfiles }     from './pages/UebaProfiles'
import { Settings }         from './pages/Settings'
import { Profile }          from './pages/Profile'
import './App.css'

const PAGES = {
  dashboard: Dashboard,
  alerts:    LiveAlerts,
  logs:      LogSearch,
  incidents: Incidents,
  soar:      SoarPlaybooks,
  ueba:      UebaProfiles,
  settings:  Settings,
  profile:   Profile,
}

function getInitialTheme() {
  const saved = localStorage.getItem('smart-siem-theme')
  if (saved) return saved
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

// ── Inner app — accès à AuthContext ──────────────────────────────────────────
function AppInner() {
  const { isAuthenticated, authStep, logout } = useAuth()

  const [authView, setAuthView]   = useState('landing')
  const [activePage, setActivePage] = useState('dashboard')
  const [theme, setTheme]         = useState(getInitialTheme)
  const ActivePage = useMemo(() => PAGES[activePage], [activePage])

  // Sync thème
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('smart-siem-theme', theme)
  }, [theme])

  // Quand le login réussit, authStep passe à 'done' → on est connecté
  useEffect(() => {
    if (authStep === 'done' && isAuthenticated) {
      setAuthView('app')
    }
  }, [authStep, isAuthenticated])

  // Loading → MFA
  useEffect(() => {
    if (authView !== 'loading') return
    const t = setTimeout(() => setAuthView('mfa'), 1100)
    return () => clearTimeout(t)
  }, [authView])

  function handleThemeChange() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  function handleLogout() {
    logout()
    setAuthView('login')
    setActivePage('dashboard')
  }

  // ── Auth screens ──────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    if (authView === 'login') {
      return (
        <Login
          theme={theme}
          onNavigate={setAuthView}
          onThemeChange={handleThemeChange}
        />
      )
    }
    if (authView === 'register') {
      return (
        <Register
          theme={theme}
          onSubmit={e => { e.preventDefault(); setAuthView('loading') }}
          onNavigate={setAuthView}
          onThemeChange={handleThemeChange}
        />
      )
    }
    if (authView === 'loading') {
      return <AuthLoading theme={theme} onThemeChange={handleThemeChange} />
    }
    if (authView === 'mfa') {
      return (
        <MfaVerification
          theme={theme}
          onVerify={() => {}}          // AuthContext gère la connexion
          onNavigate={setAuthView}
          onThemeChange={handleThemeChange}
        />
      )
    }
    if (authView === 'mfa_setup') {
      return <MfaSetup theme={theme} onThemeChange={handleThemeChange} />
    }
    // Landing (défaut)
    return (
      <Landing
        theme={theme}
        onNavigate={setAuthView}
        onThemeChange={handleThemeChange}
      />
    )
  }

  // ── App authentifiée ──────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        onLogout={handleLogout}
        onNavigate={setActivePage}
      />
      <main className="main-panel">
        <Topbar
          activePage={activePage}
          theme={theme}
          onNavigate={setActivePage}
          onThemeChange={handleThemeChange}
        />
        <ActivePage onNavigate={setActivePage} />
      </main>
    </div>
  )
}

// ── Root avec Provider ───────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}