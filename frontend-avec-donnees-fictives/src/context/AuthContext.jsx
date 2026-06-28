import { createContext, useContext, useState, useCallback } from 'react';
import { DEMO_USERS, DEMO_MFA_CODE, ROLES } from '../data/users';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [registeredUsers, setRegisteredUsers] = useState([]);

  const login = useCallback((identifier, password) => {
    const allUsers = [...DEMO_USERS, ...registeredUsers];
    const found = allUsers.find(
      (u) =>
        u.email.toLowerCase() === identifier.toLowerCase() ||
        u.username.toLowerCase() === identifier.toLowerCase()
    );
    if (!found || found.password !== password) {
      return { ok: false, error: 'Identifiants incorrects. Vérifiez votre email et mot de passe.' };
    }
    setPendingUser(found);
    return { ok: true, step: 'mfa' };
  }, [registeredUsers]);

  const verifyMfa = useCallback((code) => {
    if (!pendingUser) return { ok: false, error: 'Session expirée. Reconnectez-vous.' };
    // Pour les utilisateurs démo, utiliser le code global. Pour les nouveaux utilisateurs, utiliser leur code spécifique
    const expectedCode = pendingUser.mfaCode || DEMO_MFA_CODE;
    if (code !== expectedCode) {
      return { ok: false, error: 'Code MFA invalide. Vérifiez votre application authenticator.' };
    }
    setUser(pendingUser);
    setPendingUser(null);
    return { ok: true, user: pendingUser };
  }, [pendingUser]);

  const register = useCallback((userData) => {
    const allUsers = [...DEMO_USERS, ...registeredUsers];
    const existingUser = allUsers.find(
      (u) => u.email.toLowerCase() === userData.email.toLowerCase()
    );
    if (existingUser) {
      return { ok: false, error: 'Un compte avec cet email existe déjà.' };
    }

    // Générer un code MFA unique à 6 chiffres
    const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();

    const newUser = {
      id: Date.now(),
      name: userData.name,
      email: userData.email,
      username: userData.email.split('@')[0],
      password: userData.password,
      role: ROLES.LECTEUR,
      perimeter: 'global',
      avatar: userData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
      title: 'Utilisateur',
      lastLogin: new Date().toISOString(),
      status: 'actif',
      mfaCode: mfaCode,
    };

    setRegisteredUsers(prev => [...prev, newUser]);
    setUser(newUser);
    return { ok: true, user: newUser, mfaCode: mfaCode };
  }, [registeredUsers]);

  const cancelMfa = useCallback(() => setPendingUser(null), []);

  const logout = useCallback(() => {
    setUser(null);
    setPendingUser(null);
  }, []);

  const getAllUsers = useCallback(() => {
    return [...DEMO_USERS, ...registeredUsers];
  }, [registeredUsers]);

  return (
    <AuthContext.Provider value={{ user, pendingUser, login, verifyMfa, register, cancelMfa, logout, isAuthenticated: !!user, getAllUsers }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
