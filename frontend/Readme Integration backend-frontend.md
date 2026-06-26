# Smart SIEM — Intégration Frontend ↔ Backend
### Guide complet de connexion React + FastAPI

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Prérequis](#2-prérequis)
3. [Configuration](#3-configuration)
4. [Structure des fichiers ajoutés](#4-structure-des-fichiers-ajoutés)
5. [Fichiers à remplacer](#5-fichiers-à-remplacer)
6. [Fichiers à créer](#6-fichiers-à-créer)
7. [Flux d'authentification complet](#7-flux-dauthentification-complet)
8. [Pages connectées au backend](#8-pages-connectées-au-backend)
9. [Indicateur de santé temps réel](#9-indicateur-de-santé-temps-réel)
10. [Lancer l'application complète](#10-lancer-lapplication-complète)
11. [Tester l'intégration](#11-tester-lintégration)
12. [Problèmes fréquents](#12-problèmes-fréquents)

---

## 1. Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                      NAVIGATEUR                                 │
│                                                                 │
│   React (Vite)         axios           FastAPI (Python)         │
│   Port 5173    ──────────────────▶    Port 8000                 │
│                                                                 │
│   AuthContext          JWT Bearer      /api/v1/auth/*           │
│   useLogs              + CORS          /api/v1/logs/*           │
│   useHealth                            /health                  │
└─────────────────────────────────────────────────────────────────┘
```

**Ce qui est connecté au vrai backend :**

| Page / Composant | Endpoints utilisés |
|------------------|--------------------|
| `Login.jsx` | `POST /api/v1/auth/login` |
| `MfaVerification.jsx` | `POST /api/v1/auth/mfa/verify` |
| `MfaSetup.jsx` | `POST /api/v1/auth/mfa/setup` + `/mfa/confirm` |
| `LogSearch.jsx` | `GET /api/v1/logs` + `PATCH /api/v1/logs/{id}/flag` |
| `Settings.jsx` | `GET/POST/DELETE /api/v1/auth/users` + `GET /api/v1/auth/audit` |
| `Topbar.jsx` | `GET /health` + `GET /api/v1/logs/health` |

---

## 2. Prérequis

**Backend en cours d'exécution :**
```bash
# Containers Docker up
docker ps
# → siem_postgres (healthy) + siem_elasticsearch (healthy)

# API FastAPI démarrée
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend :**
- Node.js 18+
- npm ou yarn

---

## 3. Configuration

### Backend — CORS

Vérifier dans `backend/.env` que le frontend est autorisé :

```env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend — URL de l'API

Créer ou modifier `frontend/.env.local` :

```env
VITE_API_URL=http://localhost:8000
```

> Ce fichier n'est pas commité (.gitignore). Chaque développeur le crée localement.

### Installer les dépendances npm manquantes

```bash
cd frontend
npm install axios qrcode
```

- **axios** — client HTTP avec intercepteurs JWT automatiques
- **qrcode** — génération du QR code MFA côté client

---

## 4. Structure des fichiers ajoutés

```
frontend/src/
│
├── api/                              ← NOUVEAU DOSSIER à créer
│   ├── client.js                     ← Axios configuré + intercepteurs JWT
│   ├── auth.js                       ← Appels API authentification
│   └── logs.js                       ← Appels API logs
│
├── context/                          ← NOUVEAU DOSSIER à créer
│   └── AuthContext.jsx               ← État global auth (login, MFA, logout)
│
├── hooks/                            ← NOUVEAU DOSSIER à créer
│   ├── useLogs.js                    ← Recherche et marquage de logs
│   └── useHealth.js                  ← Polling santé backend toutes les 30s
│
├── pages/
│   ├── Login.jsx                     ← REMPLACER (connecté à l'API)
│   ├── MfaVerification.jsx           ← REMPLACER (code TOTP réel)
│   ├── MfaSetup.jsx                  ← NOUVEAU (configuration MFA premier login)
│   ├── LogSearch.jsx                 ← REMPLACER (recherche ES/PG live)
│   └── Settings.jsx                  ← REMPLACER (gestion utilisateurs live)
│
└── components/
    └── Topbar.jsx                    ← REMPLACER (indicateur santé live)

App.jsx                               ← REMPLACER (intègre AuthContext + MfaSetup)
App.css                               ← AJOUTER les styles de App.additions.css
.env.local                            ← CRÉER à la racine du frontend
```

---

## 5. Fichiers à remplacer

Remplacer chacun de ces fichiers par la version fournie :

### `src/App.jsx`
Modifications par rapport à l'original :
- Enveloppé dans `<AuthProvider>` pour l'état global d'authentification
- Nouveau état `authView = 'mfa_setup'` pour la configuration MFA premier login
- La connexion est gérée par `AuthContext` (plus de logique locale dans App)
- `onVerify` dans `MfaVerification` ne fait plus rien localement — c'est `AuthContext` qui détecte la connexion réussie

### `src/pages/Login.jsx`
- Utilise `useAuth()` → `loginStep1(email, password)`
- Champ email + mot de passe avec vrai appel HTTP
- Affichage des erreurs retournées par le backend
- Spinner pendant la requête
- Toggle show/hide mot de passe

### `src/pages/MfaVerification.jsx`
- Utilise `useAuth()` → `loginStep2(code)`
- 6 inputs individuels avec navigation automatique au clavier
- Support du copier-coller du code à 6 chiffres
- Erreur affichée si code invalide, reset automatique des champs

### `src/pages/LogSearch.jsx`
- Recherche live via `useLogs()` → `search(params)`
- Toggle moteur `Elasticsearch` / `PostgreSQL`
- Filtres avancés : IP, utilisateur, hôte, type, sévérité, plage de dates
- Pagination réelle
- Pivot IP : cliquer une IP relance la recherche filtrée
- Export CSV des résultats courants
- Vue tableau + vue timeline
- Panneau latéral détail avec marquage suspect

### `src/pages/Settings.jsx`
- Liste des utilisateurs chargée depuis `GET /api/v1/auth/users` (ADMIN)
- Création d'utilisateur via modal → `POST /api/v1/auth/users`
- Désactivation de compte → `DELETE /api/v1/auth/users/{id}`
- Journal d'audit chargé depuis `GET /api/v1/auth/audit`
- Accès conditionnel selon le rôle de l'utilisateur connecté

### `src/components/Topbar.jsx`
- Indicateur de santé dynamique via `useHealth()`
- Couleur : vert (tout OK) / orange (vérification) / rouge (dégradé)
- Tooltip sur chaque composant (PG / ES)
- Polling automatique toutes les 30 secondes

---

## 6. Fichiers à créer

### `src/api/client.js`
Client Axios central. Injecte automatiquement le token JWT sur chaque requête. Déconnecte l'utilisateur si le backend retourne 401.

### `src/api/auth.js`
Fonctions : `login()`, `verifyMfa()`, `setupMfa()`, `confirmMfa()`, `getMe()`, `listUsers()`, `createUser()`, `updateUser()`, `disableUser()`, `getAuditLog()`, `changePassword()`

### `src/api/logs.js`
Fonctions : `ingestLog()`, `ingestBatch()`, `searchLogs()`, `getLog()`, `flagLog()`, `verifyIntegrity()`, `getLogsHealth()`

### `src/context/AuthContext.jsx`
Provider React qui gère :
- `loginStep1(email, password)` — appel API + stockage token temporaire
- `loginStep2(code)` — vérification TOTP + token final
- `initMfaSetup()` — génère le QR code
- `completeMfaSetup(code)` — active le MFA
- `logout()` — nettoie le localStorage
- Déconnexion automatique sur expiration du token (intercepteur axios)

### `src/hooks/useLogs.js`
Hook `useLogs()` exposant : `results`, `total`, `loading`, `error`, `search(params)`, `flag(logId, isSuspicious, note)`

### `src/hooks/useHealth.js`
Hook `useHealth()` exposant : `health { api, postgresql, elasticsearch }`, `allOk`. Interroge le backend toutes les 30 secondes.

### `src/pages/MfaSetup.jsx`
Nouveau composant affiché au premier login (si MFA non configuré) :
- Génère et affiche le QR code depuis l'URI `otpauth://`
- Affiche le secret en texte pour saisie manuelle
- Demande le premier code de confirmation
- Option "Configurer plus tard" (non recommandé)

---

## 7. Flux d'authentification complet

```
Utilisateur
    │
    │ Saisit email + password
    ▼
Login.jsx
    │ loginStep1(email, password)
    ▼
POST /api/v1/auth/login
    │
    ├── mfa_required: false ──────────────────────────────▶ App connectée
    │
    ├── mfa_required: true ──▶ MfaVerification.jsx
    │                              │ loginStep2(code TOTP)
    │                              ▼
    │                         POST /api/v1/auth/mfa/verify
    │                              │
    │                              └──────────────────────▶ App connectée
    │
    └── mfa_enabled: false ──▶ MfaSetup.jsx
                                   │ initMfaSetup()
                                   ▼
                              POST /api/v1/auth/mfa/setup
                                   │ → { totp_uri, secret }
                                   │ Affiche QR code
                                   │
                                   │ completeMfaSetup(code)
                                   ▼
                              POST /api/v1/auth/mfa/confirm
                                   │
                                   └──────────────────────▶ App connectée
```

**Stockage local :**
```
localStorage.siem_token  — JWT Bearer token
localStorage.siem_user   — Objet utilisateur JSON
```

---

## 8. Pages connectées au backend

### LogSearch — Recherche de logs

**Fonctionnalités connectées :**
- Recherche full-text via Elasticsearch (`?engine=es`)
- Recherche structurée via PostgreSQL (`?engine=pg`)
- Filtres : IP source/dest, utilisateur, hôte, type, sévérité, plage de dates
- Pagination avec navigation
- **Pivot IP** : cliquer une IP dans les résultats relance la recherche sur cette IP
- **Export CSV** : génère un fichier `.csv` des résultats courants côté client
- **Marquage suspect** : `PATCH /api/v1/logs/{id}/flag` avec note
- Vue tableau et vue timeline interactive

**Exemple de recherche :**
```javascript
// Dans LogSearch.jsx
await search({
  keyword:   "failed password",
  severity:  "CRITICAL",
  log_type:  "AUTH",
  from_dt:   "2026-03-14T00:00:00Z",
  engine:    "es",
  page:      1,
  size:      50,
})
```

### Settings — Administration

**Fonctionnalités connectées (ADMIN uniquement) :**
- Liste des utilisateurs en temps réel
- Création d'utilisateur avec modal (username, email, password, rôle, périmètre)
- Désactivation de compte (soft delete)
- Journal d'audit (AUDITOR / ADMIN uniquement)

**Affichage conditionnel selon le rôle :**
```javascript
const isAdmin = currentUser?.role === 'ADMIN'
// Si pas ADMIN → message "Réservé aux administrateurs"
```

---

## 9. Indicateur de santé temps réel

La `Topbar` affiche l'état des services backend en permanence.

**États possibles :**

| Couleur | Signification |
|---------|---------------|
| 🟢 Vert | PostgreSQL + Elasticsearch + API opérationnels |
| 🟡 Orange | Vérification en cours (au démarrage) |
| 🔴 Rouge | Un ou plusieurs services dégradés |

**Tooltip au survol :** `PG:ok | ES:ok` (ou `PG:error | ES:ok`)

Le hook `useHealth()` appelle `/health` et `/api/v1/logs/health` toutes les **30 secondes**.

---

## 10. Lancer l'application complète

### Terminal 1 — Backend

```bash
# Dans backend/
cd docker && docker-compose up -d
cd ..
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 2 — Frontend

```bash
# Dans frontend/
npm install
npm run dev
# → http://localhost:5173
```

### Se connecter

1. Ouvrir `http://localhost:5173`
2. Cliquer "Connexion" sur la landing page
3. Utiliser un des comptes de test :

| Email | Mot de passe | Ce que vous verrez |
|-------|-------------|---------------------|
| `admin@ctu.gov` | `Admin@SIEM2026` | Tout + gestion utilisateurs |
| `c.obrian@ctu.gov` | `Analyst@CTU2026` | Logs + marquage suspects |
| `b.buchanan@ctu.gov` | `RSSI@CTU2026` | Vue synthèse |
| `t.almeida@ctu.gov` | `Auditor@CTU2026` | Audit + intégrité |
| `j.bauer@ctu.gov` | `Reader@CTU2026` | Vue lecture seule |

4. Si c'est le premier login → page de configuration MFA (scanner le QR code)
5. Les prochains logins → saisir le code TOTP à 6 chiffres

---

## 11. Tester l'intégration

### Test 1 — Login et token JWT

```javascript
// Dans la console du navigateur (après login)
JSON.parse(localStorage.getItem('siem_user'))
// → { id, username, email, role, mfa_enabled, ... }

localStorage.getItem('siem_token')
// → eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Test 2 — Recherche de logs

1. Aller dans "Recherche de logs"
2. Taper `failed password` dans la barre de recherche
3. Cliquer "Rechercher"
4. Vérifier que les résultats correspondent aux logs Brute Force SSH

### Test 3 — Pivot IP

1. Dans les résultats de recherche, cliquer sur `178.43.12.87`
2. La recherche se relance automatiquement filtrée sur cette IP

### Test 4 — Marquage suspect

1. Cliquer "Détails" sur un log
2. Activer "Marquer comme suspect"
3. Ajouter une note et cliquer "Sauvegarder"
4. Vérifier dans Swagger : `GET /api/v1/logs/{id}` → `is_suspicious: true`

### Test 5 — Gestion utilisateurs (ADMIN)

1. Connecté en tant qu'admin, aller dans "Administration"
2. Cliquer "+ Ajouter un utilisateur"
3. Remplir le formulaire et valider
4. Vérifier dans Swagger : `GET /api/v1/auth/users`

### Test 6 — Indicateur de santé

1. Observer la barre du haut → indicateur vert "Tous les systèmes opérationnels"
2. Arrêter Elasticsearch : `docker stop siem_elasticsearch`
3. Attendre 30s → l'indicateur passe en rouge "Dégradé — elasticsearch"
4. Redémarrer : `docker start siem_elasticsearch`

---

## 12. Problèmes fréquents

### Erreur CORS

```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution :** Vérifier que `ALLOWED_ORIGINS` dans `backend/.env` contient `http://localhost:5173`.

### Token expiré — déconnexion automatique

Le token JWT expire après 60 minutes (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES` dans `.env`). L'intercepteur axios détecte le 401 et déclenche un logout automatique.

### `Cannot read properties of null (reading 'role')`

**Cause :** Le composant s'affiche avant que `AuthContext` ait chargé l'utilisateur depuis le localStorage.
**Solution :** Utiliser `user?.role` (optional chaining) dans les composants.

### QR code MFA non affiché

**Cause :** La bibliothèque `qrcode` n'est pas installée.
**Solution :**
```bash
npm install qrcode
```

### Recherche Elasticsearch vide alors que des logs existent

**Cause probable :** Les logs ont été ingérés directement en base sans indexation ES.
**Solution :** Vérifier `es_indexed: true` dans la réponse d'ingestion. Si `false`, l'index ES a eu une erreur — vérifier les logs Elasticsearch.

---

*Smart SIEM — UCAC/ICAM · CTU Security Operations Center · 2026*