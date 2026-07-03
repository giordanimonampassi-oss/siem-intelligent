/**
 * API Auth — login, MFA setup/verify, profil, gestion utilisateurs.
 */
import client from './client'

// ── Authentification ─────────────────────────────────────────────────────────

/** Étape 1 : email + mot de passe */
export async function login(email, password) {
  const { data } = await client.post('/auth/login', { email, password })
  return data // { access_token, user, mfa_required }
}

/** Étape 2 : code TOTP (si MFA activé) */
export async function verifyMfa(code) {
  const { data } = await client.post('/auth/mfa/verify', { code })
  return data // { access_token, user, mfa_required: false }
}

/** Setup MFA (premier login) — retourne { totp_uri, secret } */
export async function setupMfa() {
  const { data } = await client.post('/auth/mfa/setup')
  return data
}

/** Confirme l'activation MFA avec le premier code TOTP */
export async function confirmMfa(code) {
  const { data } = await client.post('/auth/mfa/confirm', { code })
  return data
}

// ── Profil ────────────────────────────────────────────────────────────────────

export async function getMe() {
  const { data } = await client.get('/auth/me')
  return data
}

export async function changePassword(oldPassword, newPassword) {
  const { data } = await client.post('/auth/change-password', {
    old_password: oldPassword,
    new_password: newPassword,
  })
  return data
}

// ── Gestion utilisateurs (ADMIN) ──────────────────────────────────────────────

export async function listUsers(skip = 0, limit = 100) {
  const { data } = await client.get('/auth/users', { params: { skip, limit } })
  return data
}

export async function createUser(payload) {
  const { data } = await client.post('/auth/users', payload)
  return data
}

export async function updateUser(userId, payload) {
  const { data } = await client.patch(`/auth/users/${userId}`, payload)
  return data
}

export async function disableUser(userId) {
  const { data } = await client.delete(`/auth/users/${userId}`)
  return data
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export async function getAuditLog(skip = 0, limit = 100) {
  const { data } = await client.get('/auth/audit', { params: { skip, limit } })
  return data
}