# Smart SIEM — Frontend

Interface web du Smart SIEM CTU (Security Operations Center), développée en React. Cinq tableaux de bord dédiés par rôle (Analyste SOC, RSSI, Auditeur, Lecteur, Administrateur), thème clair/sombre, bilingue FR/EN, intégralement connectée au backend FastAPI.

---

## Sommaire

1. [Stack technique](#stack-technique)
2. [Structure du projet](#structure-du-projet)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Lancer le projet](#lancer-le-projet)
6. [Connexion au backend](#connexion-au-backend)
7. [Authentification & MFA](#authentification--mfa)
8. [Rôles et accès](#rôles-et-accès)
9. [Thème clair/sombre](#thème-clairsombre)
10. [Internationalisation](#internationalisation)
11. [Système de notifications](#système-de-notifications-personnalisées)
12. [Pages principales](#pages-principales)
13. [Build de production](#build-de-production)
14. [Dépannage](#dépannage)

---

## Stack technique

| Domaine | Technologie |
|---|---|
| Framework | React 18 + Vite |
| Routing | React Router v6 |
| Requêtes HTTP | Axios (intercepteurs JWT) |
| Graphiques | Recharts |
| Icônes | react-icons (Feather) |
| i18n | i18next + react-i18next |
| Dates | date-fns |
| Style | CSS natif avec variables CSS (pas de framework UI tiers) |

Aucune dépendance lourde de composants UI (pas de MUI/Antd) : tous les composants (Modal, Toast, Badge, Pagination…) sont écrits sur-mesure dans `src/components/ui/`, pour garder un contrôle total sur le design.

---

## Structure du projet

```
siem_frontend/
├── index.html
├── package.json
├── vite.config.js
├── .env.local                      # URL de l'API backend
├── public/
│   └── favicon.svg                 # Logo Smart SIEM
└── src/
    ├── main.jsx                    # Point d'entrée React
    ├── App.jsx                     # Routeur principal + Providers
    ├── index.css                   # Design system complet (variables, composants)
    │
    ├── api/                        # Couche d'accès au backend
    │   ├── client.js               # Instance Axios + intercepteurs JWT
    │   ├── auth.js                 # Endpoints auth, utilisateurs, audit
    │   ├── logs.js                 # Endpoints logs (Module 1)
    │   └── index.js                # Alertes, incidents, playbooks, UEBA, rapports
    │
    ├── context/                    # État global (React Context)
    │   ├── AuthContext.jsx         # Session, login multi-étapes, MFA
    │   ├── ThemeContext.jsx        # Thème dark/light persistant
    │   └── ToastContext.jsx        # Notifications toast personnalisées
    │
    ├── hooks/                      # Hooks réutilisables
    │   ├── useHealth.js            # Polling santé PostgreSQL/Elasticsearch
    │   ├── useLogs.js              # Recherche et marquage de logs
    │   └── useAlerts.js            # Alertes + useModal + useConfirm
    │
    ├── i18n/
    │   ├── index.js                # Config i18next
    │   ├── fr.js                   # Traductions françaises
    │   └── en.js                   # Traductions anglaises
    │
    ├── components/
    │   ├── ProtectedRoute.jsx      # Garde de route par rôle
    │   ├── layout/
    │   │   ├── Sidebar.jsx         # Navigation filtrée par rôle
    │   │   ├── Topbar.jsx          # Santé système, langue, thème, logout
    │   │   └── AppLayout.jsx       # Layout englobant (sidebar+topbar+contenu)
    │   ├── ui/
    │   │   ├── Modal.jsx           # Modal avec fond flouté
    │   │   ├── ConfirmDialog.jsx   # Remplace window.confirm
    │   │   └── index.jsx           # Badge, KpiCard, Card, Pagination, SidePanel…
    │   └── charts/
    │       ├── LogVolumeChart.jsx  # Volume logs 24h (Recharts)
    │       └── index.jsx           # Donut, TopIPs, Trend, Gauge, UEBA chart
    │
    └── pages/
        ├── HomePage.jsx            # Écran de transition post-login
        ├── auth/
        │   ├── AuthRoot.jsx        # Bascule Login/Register
        │   ├── LoginPage.jsx       # Connexion + écran MFA intégré
        │   ├── RegisterPage.jsx    # Inscription avec jauge de robustesse
        │   └── MFASetupModal.jsx   # Configuration MFA (QR code)
        ├── dashboard/
        │   ├── DashboardPage.jsx   # Routeur dashboard → rôle courant
        │   ├── DashboardAnalyst.jsx
        │   ├── DashboardRSSI.jsx
        │   ├── DashboardAuditor.jsx
        │   └── DashboardReader.jsx
        ├── alerts/
        │   ├── AlertsPage.jsx      # Liste alertes + panneau détail
        │   └── CrisisRoomPage.jsx  # Vue plein écran, refresh 5s
        ├── incidents/IncidentsPage.jsx
        ├── logs/LogsPage.jsx       # Recherche table/timeline + pivot
        ├── playbooks/PlaybooksPage.jsx   # SOAR AUTO/CONFIRM + countdown
        ├── ueba/UEBAPage.jsx       # Profils comportementaux
        ├── reports/ReportsPage.jsx # Génération PDF, intégrité SHA-256
        ├── settings/SettingsPage.jsx     # Utilisateurs, règles, rétention
        ├── audit/AuditPage.jsx     # Journal d'audit (Auditeur)
        └── profile/ProfilePage.jsx # Profil, avatar, MFA, mot de passe
```

---

## Installation

```bash
cd siem_frontend
npm install
```

---

## Configuration

Le fichier `.env.local` à la racine pointe vers l'API backend :

```env
VITE_API_URL=http://localhost:8000
```

Si le backend tourne sur Docker avec un port différent, modifiez cette valeur en conséquence. `vite.config.js` proxie également `/api` et `/health` vers cette URL pour éviter les soucis CORS en développement.

---

## Lancer le projet

```bash
npm run dev
```

L'application est accessible sur **http://localhost:5173**.

> Le backend FastAPI doit être démarré au préalable (voir le README du backend) pour que la connexion, les dashboards et toutes les pages fonctionnent avec de vraies données.

---

## Connexion au backend

Toute la communication HTTP passe par `src/api/client.js`, une instance Axios unique avec deux intercepteurs :

- **Requête** : injecte automatiquement `Authorization: Bearer <token>` depuis `localStorage`.
- **Réponse** : si le serveur renvoie `401`, le token est supprimé et l'utilisateur est redirigé vers l'écran de connexion via un événement `siem:logout`.

Chaque domaine métier a son propre fichier d'API (`auth.js`, `logs.js`, `index.js` pour alertes/incidents/playbooks/UEBA/règles/rapports), qui exporte des fonctions simples (`alertsAPI.list()`, `logsAPI.searchLogs()`, etc.) consommées par les hooks et les pages.

**Important** : les pages contiennent des données de démonstration (`mockXxx()`) utilisées en *fallback* si l'endpoint correspondant n'existe pas encore côté backend ou répond en erreur. Cela permet de développer et présenter le frontend même si certains modules backend (SOAR, UEBA, rapports…) ne sont pas encore complets — il suffit de retirer ces fallbacks au fur et à mesure que les endpoints réels sont disponibles.

---

## Authentification & MFA

Le flux de connexion est géré entièrement par `AuthContext.jsx` et suit trois étapes possibles :

1. **Login (email + mot de passe)** → `POST /api/v1/auth/login`
   - Si l'utilisateur a déjà le MFA actif → passe à l'étape 2.
   - Si l'utilisateur n'a jamais configuré le MFA → bascule vers l'écran de configuration (QR code).
2. **Vérification TOTP** → `POST /api/v1/auth/mfa/verify` — saisie à 6 cases avec auto-soumission.
3. **Configuration MFA** (premher login) → `POST /api/v1/auth/mfa/setup` puis confirmation du premier code via `POST /api/v1/auth/mfa/confirm`.

Le token JWT et les informations utilisateur sont stockés dans `localStorage` (`siem_token`, `siem_user`).

### Inscription

`RegisterPage.jsx` crée un compte avec le rôle `READER` par défaut (`POST /api/v1/auth/users`) ; l'élévation de rôle doit être effectuée par un administrateur via la page **Paramètres**.

---

## Rôles et accès

| Rôle | Valeur backend | Accès |
|---|---|---|
| Administrateur | `ADMIN` | Tout, y compris Paramètres |
| Analyste SOC | `ANALYST` | Dashboard SOC, alertes, incidents, logs, playbooks, UEBA, rapports |
| RSSI | `RSSI` | Dashboard synthétique, alertes (lecture), rapports |
| Auditeur | `AUDITOR` | Dashboard conformité, journal d'audit, rapports |
| Lecteur | `READER` | Dashboard simplifié en lecture seule, alertes (lecture), Crisis Room |

La restriction se fait à deux niveaux :

- **Navigation** (`Sidebar.jsx`) : le tableau `NAV_BY_ROLE` ne montre que les liens pertinents pour le rôle connecté — un Lecteur ne voit jamais le lien "Paramètres" par exemple.
- **Routes** (`App.jsx` + `ProtectedRoute.jsx`) : chaque route sensible est enveloppée avec `roles={['ADMIN', 'ANALYST']}` ; toute tentative d'accès direct par URL à une page non autorisée redirige vers `/dashboard`.

Le composant `DashboardPage.jsx` route automatiquement vers le bon tableau de bord (`DashboardAnalyst`, `DashboardRSSI`, `DashboardAuditor`, `DashboardReader`) selon `user.role` — chaque rôle ne voit jamais l'interface d'un autre rôle.

---

## Thème clair/sombre

Géré par `ThemeContext.jsx`. Le thème est appliqué via l'attribut `data-theme` sur `<html>`, et toutes les couleurs sont définies en variables CSS dans `index.css` (`:root` pour le dark par défaut, `[data-theme="light"]` pour la surcharge claire). Le choix est persisté dans `localStorage` (`siem_theme`).

Le bouton bascule se trouve dans la topbar (icône soleil/lune) ainsi que sur l'écran de connexion.

---

## Internationalisation

Deux langues complètes : **français** (par défaut) et **anglais**, gérées par `i18next`. Tous les textes de l'interface passent par `useTranslation()` et la fonction `t('clé.imbriquée')`. La langue choisie est persistée dans `localStorage` (`siem_lang`) et détectée automatiquement au premier chargement via `i18next-browser-languagedetector`.

Pour ajouter une chaîne de traduction : l'ajouter dans `src/i18n/fr.js` **et** `src/i18n/en.js` avec la même clé.

---

## Système de notifications personnalisées

Aucune alerte ou confirmation système (`window.alert`, `window.confirm`) n'est utilisée dans l'application :

- **Notifications ponctuelles** → `useToast()` (`ToastContext.jsx`), affichées en bas à droite, avec variantes `success/error/warning/info`.
- **Confirmations destructrices ou sensibles** → `<ConfirmDialog />`, une modale custom avec fond flouté (`backdrop-filter: blur`), utilisée par exemple pour la déconnexion, la résolution d'alerte, l'exécution de playbook ou la purge de logs.
- **Tout popup** (`Modal.jsx`, `ConfirmDialog.jsx`, `MFASetupModal.jsx`) applique un flou sur l'arrière-plan via la classe `.modal-overlay` / `.custom-alert-overlay`.

---

## Pages principales

| Route | Page | Rôles |
|---|---|---|
| `/` | Connexion / Inscription | Public |
| `/home` | Écran de transition | Connecté |
| `/dashboard` | Dashboard (variante par rôle) | Tous |
| `/alerts` | Alertes en direct | Tous |
| `/crisis` | Crisis Room (plein écran) | Tous |
| `/incidents` | Gestion des incidents | Admin, Analyste |
| `/logs` | Recherche de logs (table/timeline) | Admin, Analyste |
| `/playbooks` | Playbooks SOAR | Admin, Analyste |
| `/ueba` | Profils comportementaux | Admin, Analyste |
| `/reports` | Rapports & conformité | Tous |
| `/settings` | Utilisateurs, règles, rétention | Admin uniquement |
| `/audit` | Journal d'audit | Admin, Auditeur |
| `/profile` | Profil utilisateur, MFA, avatar | Tous |

### Points d'attention fonctionnels

- **Crisis Room** : rafraîchissement automatique toutes les 5 secondes, compteur de temps écoulé, flux d'événements simulé en direct (à remplacer par un WebSocket en production).
- **Playbooks SOAR** : différencie le mode `AUTO` (exécution immédiate) du mode `CONFIRM` (compte à rebours de 60s avec boutons Confirmer/Annuler en temps réel).
- **Recherche de logs** : double vue Table/Timeline, filtres avancés, fonction "Pivoter sur" qui relance une recherche filtrée sur une IP en un clic, marquage d'un log comme suspect avec note d'investigation.
- **UEBA** : jauge circulaire de score de risque, historique du score (graphe), liste des anomalies détectées avec leur contribution au score.

---

## Build de production

```bash
npm run build
```

Génère le dossier `dist/` prêt à être servi par n'importe quel serveur statique (Nginx, Caddy, etc.) ou inclus dans l'image Docker du frontend.

```bash
npm run preview   # Prévisualiser le build localement
```

---

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Page blanche au démarrage | Backend non démarré | Démarrer l'API FastAPI sur le port 8000 |
| Erreur CORS dans la console | `VITE_API_URL` incorrect | Vérifier `.env.local` et le proxy dans `vite.config.js` |
| Déconnexion immédiate après login | Token JWT invalide ou expiré côté backend | Vérifier `SECRET_KEY` et l'horloge serveur |
| Données de démonstration affichées au lieu des vraies | Endpoint backend manquant/en erreur | Vérifier la route concernée ; les fallbacks `mockXxx()` s'activent automatiquement en cas d'échec réseau |
| QR code MFA non scannable | Le composant génère un QR simulé (placeholder SVG) | Intégrer la librairie `qrcode` (déjà en dépendance) pour générer un vrai QR depuis `mfaData.totp_uri` |

---

## Notes pour la suite du développement

- Le placeholder QR code dans `MFASetupModal.jsx` est volontairement simplifié : la dépendance `qrcode` est déjà déclarée dans `package.json`, il suffit de l'utiliser pour générer un vrai QR code à partir de `mfaData.totp_uri`.
- Le flux temps réel de la Crisis Room utilise un `setInterval` simulé ; à remplacer par une connexion WebSocket vers le backend pour un flux réellement live.
- Les exports CSV sont générés côté client (Blob) ; l'export PDF des rapports appelle `reportsAPI.download()` qui doit retourner un blob PDF depuis le backend.