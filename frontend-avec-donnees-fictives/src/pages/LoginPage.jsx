import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDefaultRoute } from '../utils/rbac';
import { DEMO_USERS } from '../data/users';

export default function LoginPage() {
  const location = useLocation();
  const [step, setStep] = useState('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaDigits, setMfaDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const mfaRefs = useRef([]);
  const { login, verifyMfa, pendingUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.registered && location.state?.email) {
      setIdentifier(location.state.email);
      setError('');
    }
  }, [location.state]);

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const result = login(identifier, password);
    setLoading(false);
    if (result.ok) {
      setStep('mfa');
      setMfaDigits(['', '', '', '', '', '']);
    } else {
      setError(result.error);
    }
  };

  const handleMfa = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const code = mfaDigits.join('');
    const result = verifyMfa(code);
    setLoading(false);
    if (result.ok) {
      navigate(getDefaultRoute(result.user.role));
    } else {
      setError(result.error);
    }
  };

  const handleMfaChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...mfaDigits];
    next[index] = value;
    setMfaDigits(next);
    if (value && index < 5) mfaRefs.current[index + 1]?.focus();
  };

  const handleMfaKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !mfaDigits[index] && index > 0) {
      mfaRefs.current[index - 1]?.focus();
    }
  };

  useEffect(() => {
    if (step === 'mfa') mfaRefs.current[0]?.focus();
  }, [step]);

  const quickLogin = (email) => {
    setIdentifier(email);
    setPassword('ctu2026');
    setError('');
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    alert('Fonctionnalité de récupération de mot de passe simulée. Un email de réinitialisation serait envoyé.');
  };

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-container">
        <div className="login-card">
          <div className="login-brand">
            <ShieldCheck size={40} />
            <h1>Smart SIEM</h1>
            <p>Counter Terrorist Unit — Plateforme de sécurité</p>
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {step === 'credentials' ? (
            <form onSubmit={handleCredentials}>
              <div className="form-group">
                <label htmlFor="identifier">Email ou nom d&apos;utilisateur</label>
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="chloe.obrian@ctu.gov"
                  required
                  autoComplete="username"
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Mot de passe</label>
                <div className="input-with-icon">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="btn-icon input-icon-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Vérification…' : 'Se connecter'}
              </button>
              <a href="#forgot" className="login-forgot" onClick={handleForgotPassword}>
                Mot de passe oublié ?
              </a>
              <div className="login-register">
                <p>Pas encore de compte ?</p>
                <Link to="/register">Créer un compte</Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleMfa}>
              <div className="mfa-header">
                <h2>Vérification MFA</h2>
                <p>
                  Code TOTP pour <strong>{pendingUser?.email}</strong>
                </p>
              </div>
              <div className="mfa-inputs">
                {mfaDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (mfaRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleMfaChange(i, e.target.value)}
                    onKeyDown={(e) => handleMfaKeyDown(i, e)}
                    className="mfa-digit"
                    aria-label={`Chiffre ${i + 1}`}
                  />
                ))}
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading || mfaDigits.some((d) => !d)}>
                {loading ? 'Validation…' : 'Valider'}
              </button>
              <button type="button" className="btn btn-ghost btn-full" onClick={() => setStep('credentials')}>
                Retour
              </button>
            </form>
          )}
        </div>

        <div className="login-demo-panel">
          <h3>Comptes de démonstration</h3>
          <p className="demo-hint">Mot de passe : <code>ctu2026</code> · MFA : <code>123456</code></p>
          <div className="demo-users">
            {DEMO_USERS.map((u) => (
              <button key={u.id} type="button" className="demo-user-card" onClick={() => quickLogin(u.email)}>
                <span className="demo-avatar">{u.avatar}</span>
                <div>
                  <strong>{u.name}</strong>
                  <span>{u.role}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
