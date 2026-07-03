import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import LoginPage    from './LoginPage.jsx'
import RegisterPage from './RegisterPage.jsx'
import { FiSun, FiMoon, FiGlobe } from 'react-icons/fi'

export default function AuthRoot() {
  const { authView, setAuthView } = useAuth()
  const { theme, toggleTheme }    = useTheme()
  const { i18n }                  = useTranslation()

  return (
    <div style={{ position: 'relative' }}>
      {/* Contrôles flottants */}
      <div style={{
        position: 'fixed', top: 16, right: 16,
        display: 'flex', gap: 8, zIndex: 100,
      }}>
        <button className="theme-btn" onClick={toggleTheme}>
          {theme === 'dark' ? <FiSun size={16} /> : <FiMoon size={16} />}
        </button>
        <button className="lang-btn"
          onClick={() => i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr')}>
          <FiGlobe size={14} />
          {i18n.language === 'fr' ? 'FR' : 'EN'}
        </button>
      </div>

      {authView === 'register'
        ? (
          <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}>
            <div style={{
              width: '100%', maxWidth: 440,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 20, padding: '36px 32px',
              boxShadow: 'var(--shadow-lg)',
            }}>
              <RegisterPage onBack={() => setAuthView('login')} />
            </div>
          </div>
        )
        : <LoginPage />
      }
    </div>
  )
}