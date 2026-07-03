import React, { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar  from './Topbar.jsx'
import { alertsAPI } from '../../api/index.js'

export default function AppLayout() {
  const [collapsed,    setCollapsed]    = useState(false)
  const [mobileOpen,   setMobileOpen]   = useState(false)
  const [criticalCount, setCriticalCount] = useState(0)

  // Compter les alertes critiques pour le badge
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await alertsAPI.getStats()
        setCriticalCount(data?.critical_active || 0)
      } catch {/* silencieux */}
    }
    load()
    const timer = setInterval(load, 20000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="app-layout">
      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99,
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        alertBadge={criticalCount}
        className={mobileOpen ? 'mobile-open' : ''}
      />

      <Topbar
        collapsed={collapsed}
        onMenuToggle={() => setMobileOpen(v => !v)}
        alertBadge={criticalCount}
      />

      <main className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="page-wrapper">
          <Outlet />
        </div>
      </main>
    </div>
  )
}