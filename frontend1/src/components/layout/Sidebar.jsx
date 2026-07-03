import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  FiShield, FiGrid, FiAlertCircle, FiSearch, FiFileText,
  FiUsers, FiSettings, FiActivity, FiCpu, FiBarChart2,
  FiChevronLeft, FiChevronRight, FiBook, FiLayers,
} from 'react-icons/fi'

// ── Liens de navigation par rôle ──────────────────────────────────────────
const NAV_BY_ROLE = {
  admin: [
    { to: '/dashboard',   key: 'nav.dashboard',  icon: <FiGrid /> },
    { to: '/alerts',      key: 'nav.liveAlerts',  icon: <FiAlertCircle />, badgeKey: 'criticalAlerts' },
    { to: '/incidents',   key: 'nav.incidents',   icon: <FiLayers /> },
    { to: '/logs',        key: 'nav.logSearch',   icon: <FiSearch /> },
    { to: '/playbooks',   key: 'nav.playbooks',   icon: <FiCpu /> },
    { to: '/ueba',        key: 'nav.ueba',        icon: <FiActivity /> },
    { to: '/reports',     key: 'nav.reports',     icon: <FiBarChart2 /> },
    { to: '/settings',    key: 'nav.settings',    icon: <FiSettings /> },
    { to: '/profile',     key: 'nav.profile',     icon: <FiUsers /> },
  ],
  analyst: [
    { to: '/dashboard',   key: 'nav.dashboard',  icon: <FiGrid /> },
    { to: '/alerts',      key: 'nav.liveAlerts',  icon: <FiAlertCircle />, badgeKey: 'criticalAlerts' },
    { to: '/incidents',   key: 'nav.incidents',   icon: <FiLayers /> },
    { to: '/logs',        key: 'nav.logSearch',   icon: <FiSearch /> },
    { to: '/playbooks',   key: 'nav.playbooks',   icon: <FiCpu /> },
    { to: '/ueba',        key: 'nav.ueba',        icon: <FiActivity /> },
    { to: '/reports',     key: 'nav.reports',     icon: <FiBarChart2 /> },
    { to: '/profile',     key: 'nav.profile',     icon: <FiUsers /> },
  ],
  rssi: [
    { to: '/dashboard',   key: 'nav.dashboard',  icon: <FiGrid /> },
    { to: '/alerts',      key: 'nav.alerts',      icon: <FiAlertCircle /> },
    { to: '/reports',     key: 'nav.reports',     icon: <FiBarChart2 /> },
    { to: '/profile',     key: 'nav.profile',     icon: <FiUsers /> },
  ],
  auditor: [
    { to: '/dashboard',   key: 'nav.dashboard',  icon: <FiGrid /> },
    { to: '/audit',       key: 'nav.auditLog',    icon: <FiBook /> },
    { to: '/reports',     key: 'nav.reports',     icon: <FiBarChart2 /> },
    { to: '/profile',     key: 'nav.profile',     icon: <FiUsers /> },
  ],
  reader: [
    { to: '/dashboard',   key: 'nav.dashboard',  icon: <FiGrid /> },
    { to: '/alerts',      key: 'nav.alerts',      icon: <FiAlertCircle /> },
    { to: '/profile',     key: 'nav.profile',     icon: <FiUsers /> },
  ],
}

export default function Sidebar({ collapsed, onToggle, alertBadge = 0 }) {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const role = user?.role || 'READER'
  const links = NAV_BY_ROLE[role] || NAV_BY_ROLE.READER

  // Initiales pour l'avatar
  const initials = (user?.username || 'U')
    .split(/[\s_-]/).map(p => p[0]?.toUpperCase()).join('').slice(0, 2)

  const roleLabel = t(`settings.userRoles.${role}`, role)

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <FiShield size={20} color="#fff" />
        </div>
        {!collapsed && (
          <div className="sidebar-logo-text">
            <div className="sidebar-logo-title">Smart SIEM</div>
            <div className="sidebar-logo-sub">CTU — SOC</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? t(link.key) : undefined}
          >
            <span className="nav-icon">{link.icon}</span>
            <span className="nav-label">{t(link.key)}</span>
            {link.badgeKey && alertBadge > 0 && (
              <span className="nav-badge">{alertBadge > 99 ? '99+' : alertBadge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer utilisateur */}
      <div className="sidebar-footer">
        <div className="user-card" onClick={() => {}}>
          <div className="user-avatar">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt={user.username} />
              : initials}
          </div>
          {!collapsed && (
            <div className="user-info">
              <div className="user-name">{user?.username || '—'}</div>
              <div className="user-role">{roleLabel}</div>
            </div>
          )}
        </div>

        {/* Bouton collapse */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={onToggle}
          title={collapsed ? 'Déployer' : 'Réduire'}
          style={{ width: '100%', justifyContent: collapsed ? 'center' : 'flex-end', marginTop: 4 }}
        >
          {collapsed ? <FiChevronRight size={16} /> : <FiChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  )
}