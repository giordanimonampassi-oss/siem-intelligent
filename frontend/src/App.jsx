import { useEffect, useMemo, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { AuthLoading } from './pages/AuthLoading'
import { Dashboard } from './pages/Dashboard'
import { LiveAlerts } from './pages/LiveAlerts'
import { LogSearch } from './pages/LogSearch'
import { Incidents } from './pages/Incidents'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { MfaVerification } from './pages/MfaVerification'
import { Register } from './pages/Register'
import { SoarPlaybooks } from './pages/SoarPlaybooks'
import { UebaProfiles } from './pages/UebaProfiles'
import { Settings } from './pages/Settings'
import { Profile } from './pages/Profile'
import './App.css'

const pages = {
  dashboard: Dashboard,
  alerts: LiveAlerts,
  logs: LogSearch,
  incidents: Incidents,
  soar: SoarPlaybooks,
  ueba: UebaProfiles,
  settings: Settings,
  profile: Profile,
}

function getInitialTheme() {
  const savedTheme = localStorage.getItem('smart-siem-theme')

  if (savedTheme) {
    return savedTheme
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

function App() {
  const [authView, setAuthView] = useState('landing')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activePage, setActivePage] = useState('dashboard')
  const [theme, setTheme] = useState(getInitialTheme)
  const ActivePage = useMemo(() => pages[activePage], [activePage])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('smart-siem-theme', theme)
  }, [theme])

  useEffect(() => {
    if (authView !== 'loading') {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setAuthView('mfa')
    }, 1100)

    return () => window.clearTimeout(timer)
  }, [authView])

  function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthView('loading')
  }

  function handleLogout() {
    setIsAuthenticated(false)
    setAuthView('login')
    setActivePage('dashboard')
  }

  function handleThemeChange() {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  if (!isAuthenticated) {
    if (authView === 'login') {
      return (
        <Login
          theme={theme}
          onSubmit={handleAuthSubmit}
          onNavigate={setAuthView}
          onThemeChange={handleThemeChange}
        />
      )
    }

    if (authView === 'register') {
      return (
        <Register
          theme={theme}
          onSubmit={handleAuthSubmit}
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
          onVerify={() => setIsAuthenticated(true)}
          onNavigate={setAuthView}
          onThemeChange={handleThemeChange}
        />
      )
    }

    return (
      <Landing
        theme={theme}
        onNavigate={setAuthView}
        onThemeChange={handleThemeChange}
      />
    )
  }

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

export default App
