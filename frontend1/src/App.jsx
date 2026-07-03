import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AppLayout from './components/layout/AppLayout.jsx'

import AuthRoot      from './pages/auth/AuthRoot.jsx'
import HomePage       from './pages/HomePage.jsx'
import DashboardPage  from './pages/dashboard/DashboardPage.jsx'
import Dashboardanalyst from './pages/dashboard/DashboardAnalyst.jsx'
import Dashboardauditor from './pages/dashboard/DashboardAuditor.jsx'
import DashboardRSSI from './pages/dashboard/DashboardRSSI.jsx'
import DashboardReader from './pages/dashboard/DashboardReader.jsx'
import AlertsPage     from './pages/alerts/AlertsPage.jsx'
import CrisisRoomPage from './pages/alerts/CrisisRoomPage.jsx'
import IncidentsPage  from './pages/incidents/IncidentsPage.jsx'
import LogsPage       from './pages/logs/LogsPage.jsx'
import PlaybooksPage  from './pages/playbooks/PlaybooksPage.jsx'
import UEBAPage       from './pages/ueba/UEBAPage.jsx'
import ReportsPage    from './pages/reports/ReportsPage.jsx'
import SettingsPage   from './pages/settings/SettingsPage.jsx'
import AuditPage      from './pages/audit/AuditPage.jsx'
import ProfilePage    from './pages/profile/ProfilePage.jsx'

import './i18n/index.js'

function RoleBasedDashboard() {
  const { user } = useAuth()
  const role = user?.role?.toUpperCase()
  console.log(`🔄 RoleBasedDashboard → Rôle détecté : ${role}`)
  switch (role) {
    case 'rssi':
    case 'admin':                    // admin traité comme RSSI pour l'instant
      return <DashboardRSSI />       // ou garde <DashboardPage /> si tu veux
    case 'analyst':
      return <Dashboardanalyst />       // Dashboard principal par défaut
    case 'auditor':
      return <Dashboardauditor />       // À ajuster plus tard
    case 'reader':
      return <DashboardReader />  // ← futur dashboard pour Reader
      // return <DashboardPage />       // pour l'instant on reste sur le dashboard général
    default:
      return <DashboardPage />
  }
}

// ── Racine : redirige vers login ou home selon l'état d'auth ──────────────
function RootGate() {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/home" replace /> : <AuthRoot />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/" element={<RootGate />} />
      <Route path="/home" element={
        <ProtectedRoute><HomePage /></ProtectedRoute>
      } />

      {/* Crisis room — fullscreen, hors layout */}
      <Route path="/crisis" element={
        <ProtectedRoute><CrisisRoomPage /></ProtectedRoute>
      } />

      {/* App avec layout (sidebar + topbar) */}
      <Route element={
        <ProtectedRoute><AppLayout /></ProtectedRoute>
      }>
        <Route path="/dashboard" element={<RoleBasedDashboard />} />
        <Route path="/alerts"    element={<AlertsPage />} />

        <Route path="/incidents" element={
          <ProtectedRoute roles={['admin', 'analyst']}><IncidentsPage /></ProtectedRoute>
        } />
        <Route path="/logs" element={
          <ProtectedRoute roles={['admin', 'analyst']}><LogsPage /></ProtectedRoute>
        } />
        <Route path="/playbooks" element={
          <ProtectedRoute roles={['admin', 'analyst']}><PlaybooksPage /></ProtectedRoute>
        } />
        <Route path="/ueba" element={
          <ProtectedRoute roles={['admin', 'analyst']}><UEBAPage /></ProtectedRoute>
        } />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={
          <ProtectedRoute roles={['admin']}><SettingsPage /></ProtectedRoute>
        } />
        <Route path="/audit" element={
          <ProtectedRoute roles={['admin', 'auditor']}><AuditPage /></ProtectedRoute>
        } />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}