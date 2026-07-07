# Smart SIEM — CTU Security Operations Center

**Projet étudiant — UCAC/ICAM**
Système de Gestion et d'Analyse des Événements de Sécurité

---

## Sommaire

1. [C'est quoi un SIEM, en une phrase ?](#1-cest-quoi-un-siem-en-une-phrase-)
2. [Le contexte du projet](#2-le-contexte-du-projet)
3. [Comment le projet est construit (vue d'ensemble)](#3-comment-le-projet-est-construit-vue-densemble)
4. [Module 1 — Collecte et normalisation des logs](#4-module-1--collecte-et-normalisation-des-logs)
5. [Module 2 — Stockage, indexation et conservation](#5-module-2--stockage-indexation-et-conservation)
6. [Module 3 — Corrélation d'événements](#6-module-3--corrélation-dévénements)
7. [Module 3bis — Alertes et réponse automatique (SOAR)](#7-module-3bis--alertes-et-réponse-automatique-soar)
8. [Module 4 — Analyse comportementale (UEBA)](#8-module-4--analyse-comportementale-ueba)
9. [Module 5 — Visualisation et rapports](#9-module-5--visualisation-et-rapports)
10. [Recherche et investigation](#10-recherche-et-investigation)
11. [Gestion des utilisateurs et sécurité d'accès](#11-gestion-des-utilisateurs-et-sécurité-daccès)
12. [Installation et lancement du projet](#12-installation-et-lancement-du-projet)
13. [Structure des dossiers](#13-structure-des-dossiers)
14. [Petit glossaire](#14-petit-glossaire)

---

## 1. C'est quoi un SIEM, en une phrase ?

Imagine une entreprise avec des centaines d'ordinateurs, serveurs et équipements réseau. Chacun d'eux produit en permanence des petites notes appelées **logs** : *"Untel s'est connecté à 8h12"*, *"Tentative de connexion refusée depuis telle adresse"*, *"Tel fichier a été ouvert"*...

Pris séparément, ces notes ne veulent presque rien dire. Mais un **SIEM** (Security Information and Event Management) est le système qui les collecte **toutes**, les compare entre elles, et sonne l'alarme quand leur combinaison ressemble à une attaque — un peu comme un veilleur de nuit qui ne regarderait pas une seule caméra, mais toutes les caméras du bâtiment en même temps, et qui saurait reconnaître un comportement suspect avant qu'il ne soit trop tard.

**Smart SIEM** va plus loin qu'un simple système de collecte : il **décide**. Il corrèle les signaux, calcule un niveau de risque, déclenche des actions automatiques (bloquer une IP, désactiver un compte) et alerte les bonnes personnes en quelques secondes.

---

## 2. Le contexte du projet

Pour rendre le projet concret, on s'est mis dans la peau d'une **cellule antiterroriste (CTU)** fictive qui doit se doter d'un SIEM pour protéger son réseau. Chaque fonctionnalité technique correspond à un besoin opérationnel réel :

| Ce que fait le système | Pourquoi c'est utile, concrètement |
|---|---|
| Recevoir tous les logs de l'infrastructure | Voir tout ce qui se passe sur le réseau, sans angle mort |
| Relier plusieurs événements isolés entre eux | Reconnaître une attaque qui se cache derrière plusieurs petits signaux anodins |
| Réagir automatiquement | Bloquer un compte compromis en quelques secondes, sans attendre qu'un humain ait le temps de réagir |
| Repérer un comportement inhabituel | Détecter qu'un employé de confiance se comporte soudain bizarrement (connexion à 3h du matin, téléchargement massif...) |
| Produire des rapports | Prouver, preuves à l'appui (hash cryptographique), que les logs n'ont pas été trafiqués |

---

## 3. Comment le projet est construit (vue d'ensemble)

Le système est composé de trois grandes parties qui communiquent entre elles :

- **Le frontend** (l'interface qu'on voit à l'écran) : tableaux de bord, listes d'alertes, recherche, etc. Construit avec **React**.
- **Le backend** (le "cerveau" qui fait tourner toute la logique) : reçoit les logs, applique les règles, déclenche les actions. Construit avec **FastAPI** (Python).
- **Les bases de données** :
  - **PostgreSQL** garde les données structurées (utilisateurs, alertes, règles, rapports...)
  - **Elasticsearch** garde le contenu brut des logs, optimisé pour la recherche rapide sur de gros volumes

Le backend est lui-même découpé en modules indépendants, décrits un par un ci-dessous — c'est plus facile à construire, tester et faire évoluer séparément qu'un seul gros bloc de code.

---

## 4. Module 1 — Collecte et normalisation des logs

**À quoi ça sert :** c'est la porte d'entrée de tout le système. Sans logs, un SIEM n'a rien à analyser.

**Comment ça marche concrètement :**
Les équipements de l'infrastructure (serveurs Linux, Windows, pare-feu, applications...) envoient chacun leurs logs dans des formats différents — un peu comme si chaque témoin d'un incident racontait les faits dans une langue différente. Le module 1 traduit tout ça dans **un seul format commun** (avec des champs standards : date, adresse IP source, type d'événement, niveau de gravité, message).

Chaque log reçoit aussi automatiquement deux étiquettes :
- une **criticité** : `info` (normal), `warning` (à surveiller), `critical` (grave)
- un **type** : authentification, réseau, système, application...

C'est ce classement automatique qui permet, plus tard, de ne pas devoir lire un million de lignes une par une pour repérer ce qui compte.

---

## 5. Module 2 — Stockage, indexation et conservation

**À quoi ça sert :** une fois les logs normalisés, il faut pouvoir les retrouver instantanément — même six mois plus tard — et garantir qu'ils n'ont pas été modifiés depuis.

**Comment ça marche concrètement :**
- Les logs sont indexés (un peu comme l'index d'un livre) sur leur date, leur source, leur type et leur gravité, ce qui permet des recherches quasi instantanées même sur des millions de lignes.
- Les communications sont chiffrées (**TLS**), et les données sensibles le sont aussi au repos.
- Une politique de rétention définit combien de temps les logs sont gardés (30 jours, 6 mois, 1 an...) avant d'être automatiquement purgés — utile pour rester conforme aux règles légales (RGPD).
- Un système d'**empreinte numérique** (hash SHA-256) est calculé sur chaque lot de logs archivés. Si quelqu'un modifiait ne serait-ce qu'un caractère dans un log après coup, l'empreinte recalculée ne correspondrait plus à l'originale — ça permet de **prouver l'intégrité** des preuves en cas d'enquête judiciaire.

---

## 6. Module 3 — Corrélation d'événements

**À quoi ça sert :** c'est le cœur "intelligent" du système. Un événement isolé est rarement une menace — c'est **la combinaison** de plusieurs signaux, dans un certain ordre et une certaine fenêtre de temps, qui révèle une vraie attaque.

**Exemple concret :** 5 tentatives de connexion échouées en 60 secondes depuis la même adresse IP, ce n'est pas anodin — ça ressemble à une tentative de deviner un mot de passe (**brute-force**). Une seule tentative échouée, en revanche, ne veut rien dire (tout le monde se trompe parfois de mot de passe).

**Comment ça marche concrètement :**
Le système applique des **règles de corrélation**, deux types principaux :
- **Règles à seuil** : "si tel événement se produit plus de N fois en X secondes → alerte"
- **Règles séquentielles** : "si tel événement A est suivi de tel événement B dans un certain délai → alerte" (utile pour détecter des chaînes d'attaque plus complexes)

Ces règles sont alignées sur un référentiel mondial appelé **MITRE ATT&CK**, qui catalogue les techniques d'attaque connues (reconnaissance, mouvement latéral, exfiltration de données...). Ça permet de parler le même langage que n'importe quel professionnel de la cybersécurité dans le monde.

Quand une règle se déclenche, le système crée une **Alerte**, avec un niveau de gravité (`INFO`, `WARNING`, `HIGH`, `CRITICAL`).

---

## 7. Module 3bis — Alertes et réponse automatique (SOAR)

**À quoi ça sert :** détecter une menace, c'est bien. La bloquer avant qu'elle ne fasse de dégâts, c'est encore mieux — et c'est là qu'intervient le **SOAR** (Security Orchestration, Automation and Response), c'est-à-dire la capacité du système à **agir de lui-même**.

**Comment ça marche concrètement :**
Dès qu'une alerte grave est créée, le système déclenche automatiquement un ou plusieurs **playbooks** (des procédures de réponse préécrites) :

- **Bloquer l'adresse IP** suspecte sur le pare-feu
- **Désactiver un compte** utilisateur compromis
- **Prévenir l'équipe** de sécurité (email, notification Slack/Teams)

Ces actions se déclenchent selon deux modes :
- **Mode automatique** : l'action se fait immédiatement, sans intervention humaine (par exemple bloquer une IP externe suspecte — peu de risque à agir vite).
- **Mode confirmation** : un délai de grâce (60 secondes par défaut) est laissé à un analyste humain pour confirmer ou annuler l'action avant qu'elle ne s'exécute — par exemple pour désactiver le compte d'un employé, où une erreur pourrait avoir des conséquences gênantes s'il s'agit d'un faux positif. Si personne n'intervient dans le délai, l'action se fait quand même automatiquement — le système ne reste jamais bloqué en attente indéfiniment.

Toutes ces actions sont journalisées, pour qu'on puisse toujours reconstituer après coup qui (ou quoi) a fait quoi, et quand.

---

## 8. Module 4 — Analyse comportementale (UEBA)

**À quoi ça sert :** certaines menaces ne ressemblent à aucune attaque connue — elles viennent de l'intérieur. Un employé de confiance dont le compte a été piraté, ou qui agit lui-même de façon malveillante, ne déclenchera aucune des règles "classiques" du module 3, puisqu'il utilise des accès légitimes.

**UEBA** (User and Entity Behavior Analytics) résout ce problème d'une façon différente : au lieu de chercher des signatures d'attaques connues, il apprend le comportement **normal** de chaque personne (et de chaque machine), puis repère les écarts.

**Comment ça marche concrètement :**
1. **Apprentissage de la baseline** : le système observe le comportement habituel de chaque utilisateur — à quelle heure il se connecte d'habitude, quel volume de données il manipule en moyenne, quelles machines il utilise régulièrement.
2. **Détection d'écarts** : chaque nouvel événement est comparé à cette "normalité". Trois types d'anomalies sont recherchés :
   - **Anomalie horaire** : connexion à une heure inhabituelle (ex : 3h du matin pour quelqu'un qui travaille habituellement de 8h à 18h)
   - **Anomalie de volume** : quantité de données manipulée très supérieure à d'habitude (signe possible d'un vol de données en cours)
   - **Anomalie de ressource** : accès à une machine ou un dossier jamais consulté auparavant
3. **Score de risque** : chaque anomalie détectée augmente un score de risque (de 0 à 100) associé à la personne ou à la machine. Plus les écarts s'accumulent, plus le score grimpe.
4. **Escalade automatique** : si le score dépasse un certain seuil, le système crée automatiquement une alerte — qui peut à son tour déclencher les playbooks SOAR du module précédent. La boucle est bouclée : un comportement suspect peut, sans aucune intervention humaine, mener jusqu'au blocage effectif du compte concerné.

C'est un peu comme un collègue vigilant qui remarquerait : *"Tiens, c'est bizarre, elle ne se connecte jamais à cette heure-là d'habitude..."* — sauf que le système, lui, ne dort jamais et surveille tout le monde en permanence.

---

## 9. Module 5 — Visualisation et rapports

**À quoi ça sert :** toutes ces données ne servent à rien si personne ne peut les comprendre rapidement. Un analyste technique, un responsable sécurité (RSSI) et un auditeur n'ont pas du tout les mêmes besoins face au même système.

**Comment ça marche concrètement :**
- **Tableau de bord principal** : vue d'ensemble en temps réel (top alertes, volume de logs, carte des sources d'attaque...)
- **Vues adaptées par profil** : un analyste veut du détail technique, un RSSI veut une synthèse visuelle qu'il peut comprendre en 10 secondes en entrant dans une salle de crise, un auditeur veut des preuves de conformité.
- **Rapports automatiques** : génération périodique (quotidienne, hebdomadaire) de rapports PDF résumant l'activité de sécurité de la période, avec export possible en Excel/CSV pour les audits externes.
- **Preuve d'intégrité** : chaque rapport est accompagné d'une empreinte numérique (hash), pour garantir que les chiffres présentés n'ont pas été trafiqués après coup.

---

## 10. Recherche et investigation

**À quoi ça sert :** après un incident, il faut souvent reconstituer précisément ce qui s'est passé — comme un enquêteur qui reconstitue une scène de crime minute par minute.

**Comment ça marche concrètement :**
- **Recherche multi-critères** : retrouver tous les logs correspondant à une IP, un utilisateur, une plage horaire ou un niveau de gravité donné.
- **Timeline interactive** : visualiser les événements dans l'ordre chronologique, pour comprendre comment une attaque s'est déroulée étape par étape.
- **Pivot sur un indicateur** : à partir d'un événement suspect, afficher en un clic tous les autres événements liés à la même machine ou au même utilisateur sur les dernières 24 heures — pour remonter jusqu'au point d'entrée exact de l'attaquant.

---

## 11. Gestion des utilisateurs et sécurité d'accès

**À quoi ça sert :** un SIEM qui protège tout le monde sauf lui-même n'a aucun sens. L'accès au système est donc lui-même verrouillé.

**Comment ça marche concrètement :**
- **Authentification à deux facteurs (MFA)** : en plus du mot de passe, un code temporaire (généré par une application comme Google Authenticator) est exigé — même si le mot de passe est volé, l'attaquant ne peut pas se connecter sans ce second code.
- **Rôles (RBAC)** : chaque personne n'a accès qu'à ce dont elle a besoin.
  - **Lecteur** : peut consulter, rien de plus
  - **Analyste** : peut traiter les alertes, déclencher des playbooks
  - **RSSI** : vue synthétique de pilotage
  - **Auditeur** : accès aux journaux d'audit et aux preuves de conformité
  - **Administrateur** : gestion complète des comptes et des droits
- **Journal d'audit** : chaque action sensible (connexion, modification d'un rôle, consultation d'une alerte...) est enregistrée, avec qui l'a faite et quand — pour qu'en cas de problème, on puisse toujours savoir ce qui s'est passé, même si le problème vient d'un compte interne.

---

## 12. Installation et lancement du projet

> Adapte cette section selon la configuration réelle de votre environnement (ports, noms de conteneurs, etc.)

### Prérequis
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Elasticsearch 8+
- (optionnel) Docker, pour simplifier le lancement des bases de données

### Backend

```bash
cd backend/app
python -m venv siem
source siem/bin/activate        # Windows : siem\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # puis renseigner les vraies valeurs
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

L'interface est ensuite accessible sur `http://localhost:5173`, et la documentation interactive de l'API sur `http://localhost:8000/docs`.

---

## 13. Structure des dossiers

```
backend/
├── app/
│   ├── api/v1/endpoints/   → les routes HTTP (une par module : alerts, ueba, reports...)
│   ├── core/               → configuration, constantes, sécurité
│   ├── db/                 → connexion aux bases de données
│   ├── models/             → structure des tables (SQLAlchemy)
│   ├── schemas/            → format des données échangées avec le frontend
│   └── services/           → toute la logique métier (corrélation, SOAR, UEBA...)
frontend/
└── src/
    ├── pages/              → une page par fonctionnalité (dashboard, alertes, ueba...)
    ├── components/         → éléments réutilisables (graphiques, cartes, modales...)
    └── api/                → appels vers le backend
```

---

## 14. Petit glossaire

| Terme | Explication simple |
|---|---|
| **SIEM** | Le système global qui collecte, analyse et réagit aux événements de sécurité |
| **Log** | Une ligne d'information générée automatiquement par un système ("qui a fait quoi, quand") |
| **Alerte** | Une notification créée quand le système détecte quelque chose de suspect |
| **Corrélation** | Le fait de relier plusieurs événements séparés pour repérer un motif suspect |
| **SOAR** | La capacité du système à réagir automatiquement (bloquer, désactiver, notifier) |
| **Playbook** | Une procédure de réponse préécrite, exécutée automatiquement ou après confirmation |
| **UEBA** | L'analyse du comportement habituel de chaque personne/machine pour repérer les écarts |
| **Score de risque** | Une note de 0 à 100 qui reflète à quel point le comportement récent d'une entité est inhabituel |
| **MITRE ATT&CK** | Un catalogue mondial des techniques d'attaque connues, utilisé comme référence commune |
| **RBAC** | Le système de rôles qui définit qui a le droit de voir ou faire quoi |
| **MFA** | La double authentification (mot de passe + code temporaire) |
| **Hash SHA-256** | Une empreinte numérique unique d'un fichier ; si le fichier change, l'empreinte change aussi — ça sert de preuve d'intégrité |
| **RGPD** | Le règlement européen sur la protection des données personnelles |

---

*Projet réalisé dans le cadre du cursus ingénieur UCAC/ICAM — module Smart SIEM.*