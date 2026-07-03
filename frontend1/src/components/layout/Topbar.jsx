import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import { useHealth } from '../../hooks/useHealth.js'
import { useConfirm } from '../../hooks/useAlerts.js'
import ConfirmDialog from '../ui/ConfirmDialog.jsx'
import {
  FiSun, FiMoon, FiBell, FiMenu, FiLogOut, FiUser,
  FiGlobe, FiChevronRight,
} from 'react-icons/fi'

// Map route → breadcrumb
const BREADCRUMB = {
  '/dashboard':  ['nav.dashboard'],
  '/alerts':     ['nav.liveAlerts'],
  '/incidents':  ['nav.incidents'],
  '/logs':       ['nav.logSearch'],
  '/playbooks':  ['nav.playbooks'],
  '/ueba':       ['nav.ueba'],
  '/reports':    ['nav.reports'],
  '/settings':   ['nav.settings'],
  '/audit':      ['nav.auditLog'],
  '/profile':    ['nav.profile'],
}

export default function Topbar({ collapsed, onMenuToggle, alertBadge = 0 }) {
  const { t, i18n } = useTranslation()
  const { logout }  = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate    = useNavigate()
  const location    = useLocation()
  const { health, allOk } = useHealth()
  const { confirm, state: confirmState, handleConfirm, handleCancel } = useConfirm()
  const [showLang, setShowLang] = useState(false)

  const crumbs = BREADCRUMB[location.pathname] || []
  const healthStatus = allOk
    ? 'ok'
    : Object.values(health).includes('error')
      ? 'error'
      : 'warn'

  const handleLogout = async () => {
    const ok = await confirm({
      title: t('auth.logout'),
      message: 'Voulez-vous vraiment vous déconnecter ?',
      confirmLabel: t('auth.logout'),
      type: 'warning',
    })
    if (ok) logout()
  }

  const toggleLang = (lng) => {
    i18n.changeLanguage(lng)
    setShowLang(false)
  }

  return (
    <>
      <header className={`topbar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Hamburger mobile */}
        <button className="topbar-btn" onClick={onMenuToggle} style={{ display: 'none' }}>
          <FiMenu />
        </button>

        {/* Breadcrumb */}
        <div className="topbar-breadcrumb">
          <span>Smart SIEM</span>
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              <FiChevronRight size={12} style={{ opacity: 0.4 }} />
              <strong>{t(c)}</strong>
            </React.Fragment>
          ))}
        </div>

        <div className="topbar-actions">
          {/* Santé système */}
          <div
            className="health-indicator"
            title={
              `PostgreSQL: ${health.postgresql} | Elasticsearch: ${health.elasticsearch}`
            }
          >
            <span className={`health-dot ${healthStatus}`} />
            <span style={{ fontSize: '0.72rem' }}>
              {healthStatus === 'ok'
                ? t('health.allGood')
                : t('health.degraded')}
            </span>
          </div>

          {/* Langue */}
          <div style={{ position: 'relative' }}>
            <button
              className="lang-btn"
              onClick={() => setShowLang(v => !v)}
            >
              <FiGlobe size={14} />
              {i18n.language === 'fr' ? 'FR' : 'EN'}
            </button>
            {showLang && (
              <div style={{
                position: 'absolute', top: '110%', right: 0,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '4px',
                zIndex: 300,
                minWidth: 80,
                boxShadow: 'var(--shadow-md)',
              }}>
                {['fr', 'en'].map(lng => (
                  <button
                    key={lng}
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => toggleLang(lng)}
                  >
                    {lng === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Thème */}
          <button
            className="theme-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
          >
            {theme === 'dark' ? <FiSun size={16} /> : <FiMoon size={16} />}
          </button>

          {/* Notifications */}
          <button
            className="topbar-btn"
            onClick={() => navigate('/alerts')}
            title={t('nav.alerts')}
          >
            <FiBell size={17} />
            {alertBadge > 0 && <span className="notif-badge" />}
          </button>

          {/* Profil */}
          <button
            className="topbar-btn"
            onClick={() => navigate('/profile')}
            title={t('nav.profile')}
          >
            <FiUser size={17} />
          </button>

          {/* Déconnexion */}
          <button
            className="topbar-btn"
            onClick={handleLogout}
            title={t('auth.logout')}
          >
            <FiLogOut size={17} />
          </button>
        </div>
      </header>

      <ConfirmDialog
        isOpen={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        type={confirmState?.type}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  )
}