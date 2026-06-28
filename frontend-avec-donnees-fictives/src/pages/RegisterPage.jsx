import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, User, Mail, Lock, Building, ArrowLeft, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDefaultRoute } from '../utils/rbac';

/**
 * Register Page Component
 * 
 * Page d'inscription pour créer un nouveau compte utilisateur
 * Formulaire avec validation et création de compte
 * 
 * @component
 * @returns {JSX.Element} Page d'inscription avec formulaire
 */
export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [generatedMfaCode, setGeneratedMfaCode] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    setApiError('');
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }
    
    if (!formData.company.trim()) {
      newErrors.company = 'L\'entreprise est requise';
    }
    
    if (!formData.password) {
      newErrors.password = 'Le mot de passe est requis';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsLoading(true);
    setApiError('');
    
    const result = register({
      name: formData.name,
      email: formData.email,
      company: formData.company,
      password: formData.password
    });
    
    setIsLoading(false);
    
    if (result.ok) {
      setGeneratedMfaCode(result.mfaCode);
      setShowMfaModal(true);
    } else {
      setApiError(result.error);
    }
  };

  return (
    <div className="register-page">
      <div className="register-bg"></div>
      
      <div className="register-container">
        <div className="register-card">
          <Link to="/" className="back-link">
            <ArrowLeft size={16} />
            Retour à l'accueil
          </Link>
          
          <div className="register-brand">
            <ShieldCheck size={32} />
            <div>
              <h1>Créer un compte</h1>
              <p>Rejoignez Smart SIEM</p>
            </div>
          </div>

          {apiError && (
            <div className="alert alert-error">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="register-form">
            <div className="form-group">
              <label htmlFor="name">
                <User size={16} />
                Nom complet
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                className={errors.name ? 'error' : ''}
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="email">
                <Mail size={16} />
                Email professionnel
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john@company.com"
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="company">
                <Building size={16} />
                Entreprise
              </label>
              <input
                type="text"
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                placeholder="Votre entreprise"
                className={errors.company ? 'error' : ''}
              />
              {errors.company && <span className="error-message">{errors.company}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="password">
                <Lock size={16} />
                Mot de passe
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={errors.password ? 'error' : ''}
              />
              {errors.password && <span className="error-message">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">
                <Lock size={16} />
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className={errors.confirmPassword ? 'error' : ''}
              />
              {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={isLoading}
            >
              {isLoading ? 'Création en cours...' : 'Créer mon compte'}
            </button>
          </form>

          <div className="register-footer">
            <p>Déjà inscrit ?</p>
            <Link to="/login">Se connecter</Link>
          </div>
        </div>
      </div>

      {showMfaModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <button
                className="modal-close"
                onClick={() => setShowMfaModal(false)}
              >
                <X size={20} />
              </button>
              <ShieldCheck size={32} />
              <h2>Compte créé avec succès !</h2>
            </div>
            <div className="modal-body">
              <p>Votre code de vérification MFA est :</p>
              <div className="mfa-code-display">
                <code>{generatedMfaCode}</code>
              </div>
              <p className="mfa-hint">
                <strong>Important :</strong> Sauvegardez ce code. Il sera requis pour vos futures connexions.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary btn-full"
                onClick={() => navigate('/dashboard')}
              >
                Accéder au dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
