import { Link } from 'react-router-dom';
import { Shield, Activity, Lock, Zap, ArrowRight, Check } from 'lucide-react';

/**
 * Landing Page Component
 * 
 * Page d'accueil publique présentant Smart SIEM
 * Permet aux visiteurs de découvrir la plateforme et de s'inscrire
 * 
 * @component
 * @returns {JSX.Element} Page d'accueil avec hero, features et CTA
 */
export default function LandingPage() {
  const handleDocumentation = (e) => {
    e.preventDefault();
    alert('Page de documentation simulée');
  };

  const handleSupport = (e) => {
    e.preventDefault();
    alert('Page de support simulée');
  };
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <Shield size={16} />
            <span>Sécurité Opérationnelle de Nouvelle Génération</span>
          </div>
          <h1>Smart SIEM</h1>
          <p className="hero-subtitle">
            Plateforme de détection et réponse aux incidents de sécurité en temps réel.
            Protégez votre infrastructure avec l'intelligence comportementale et l'automatisation SOAR.
          </p>
          <div className="hero-cta">
            <Link to="/register" className="btn btn-primary btn-lg">
              Commencer gratuitement <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="btn btn-secondary btn-lg">
              Se connecter
            </Link>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <strong>99.9%</strong>
              <span>Disponibilité</span>
            </div>
            <div className="stat">
              <strong>&lt;1s</strong>
              <span>Détection</span>
            </div>
            <div className="stat">
              <strong>24/7</strong>
              <span>Monitoring</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="landing-section">
        <div className="section-header">
          <h2>Fonctionnalités Principales</h2>
          <p>Une suite complète pour la sécurité de votre infrastructure</p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <Activity size={32} />
            </div>
            <h3>Détection en Temps Réel</h3>
            <p>Surveillance continue de vos logs et alertes instantanées grâce à notre moteur de corrélation avancé.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <Shield size={32} />
            </div>
            <h3>UEBA Intégré</h3>
            <p>Analyse comportementale des utilisateurs et entités pour détecter les menaces internes et les comptes compromis.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <Lock size={32} />
            </div>
            <h3>Automatisation SOAR</h3>
            <p>Réponse automatique aux incidents avec playbooks configurables pour réduire le MTTR.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <Zap size={32} />
            </div>
            <h3>Crisis Room</h3>
            <p>Interface dédiée à la gestion de crise en temps réel pour coordonner les équipes pendant les incidents majeurs.</p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="landing-section landing-section-alt">
        <div className="section-header">
          <h2>Pourquoi Smart SIEM ?</h2>
          <p>La solution de sécurité choisie par les entreprises modernes</p>
        </div>
        <div className="benefits-grid">
          <div className="benefit-item">
            <Check size={20} className="benefit-icon" />
            <div>
              <strong>Déploiement en minutes</strong>
              <p>Configuration simple et rapide sans infrastructure complexe</p>
            </div>
          </div>
          <div className="benefit-item">
            <Check size={20} className="benefit-icon" />
            <div>
              <strong>Intégration facile</strong>
              <p>Compatible avec vos outils existants (SIEM, EDR, Firewall)</p>
            </div>
          </div>
          <div className="benefit-item">
            <Check size={20} className="benefit-icon" />
            <div>
              <strong>Conformité RGPD</strong>
              <p>Tableaux de bord dédiés pour le suivi de la conformité</p>
            </div>
          </div>
          <div className="benefit-item">
            <Check size={20} className="benefit-icon" />
            <div>
              <strong>Support 24/7</strong>
              <p>Équipe d'experts disponible à tout moment</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-cta">
        <div className="cta-content">
          <h2>Prêt à sécuriser votre infrastructure ?</h2>
          <p>Rejoignez des centaines d'entreprises qui font confiance à Smart SIEM</p>
          <Link to="/register" className="btn btn-primary btn-lg">
            Créer un compte gratuit <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <Shield size={24} />
            <span>Smart SIEM</span>
          </div>
          <div className="footer-links">
            <Link to="/login">Connexion</Link>
            <Link to="/register">Inscription</Link>
            <Link to="#" onClick={handleDocumentation}>Documentation</Link>
            <Link to="#" onClick={handleSupport}>Support</Link>
          </div>
          <p className="footer-copyright">© 2026 Smart SIEM. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
