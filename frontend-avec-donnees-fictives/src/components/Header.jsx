import { Search, Bell, Sun, Moon, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';

/**
 * Header Component
 *
 * Barre de navigation fixe en haut de l'application
 * Contient la recherche, les indicateurs système, les notifications et le profil utilisateur
 *
 * @component
 * @returns {JSX.Element} Header fixe avec recherche et contrôles utilisateur
 */
export default function Header() {
  const { user } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Charger le thème depuis localStorage au montage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  // Basculer entre mode sombre et mode clair
  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      alert(`Recherche simulée: ${e.target.value}`);
    }
  };

  const handleNotifications = () => {
    alert('Notifications simulées - 3 nouvelles alertes');
  };

  return (
    <header className="top-header">
      <div className="header-left">
        {/* Barre de recherche pour les logs, IPs et événements */}
        <div className="search-bar">
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Rechercher logs, IPs, événements..." onKeyDown={handleSearch} />
        </div>
      </div>

      <div className="header-right">
        {/* Indicateur de navigation breadcrumb */}
        <div className="header-indicator">
          <span className="indicator-label">SOC</span>
          <span className="indicator-separator">›</span>
          <span className="indicator-value">Dashboard</span>
        </div>

        {/* Indicateur de santé système avec animation pulse */}
        <div className="system-health">
          <div className="health-dot"></div>
          <span className="health-text">SANTÉ SYSTÈME : OPTIMALE</span>
        </div>

        {/* Bouton de notifications avec badge */}
        <button className="header-btn" title="Notifications" onClick={handleNotifications}>
          <Bell size={18} />
          <span className="notification-badge">3</span>
        </button>

        {/* Bouton de toggle thème sombre/clair */}
        <button className="header-btn" title={isDarkMode ? "Mode clair" : "Mode sombre"} onClick={toggleTheme}>
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Avatar utilisateur */}
        <div className="header-user">
          <div className="user-avatar sm">{user.avatar}</div>
        </div>
      </div>
    </header>
  );
}
