

Ce dossier regroupe l'ensemble de la logique de stockage persistant, des structures relationnelles SQL et de l'initialisation de la base de données du SIEM de la CTU.


🏛️ 1. Architecture de Stockage Hybride

Le Smart SIEM repose sur un modèle d'ingestion et de persistance hybride pour répondre aux contraintes de haute performance (millions de logs par seconde) et de traçabilité légale exigées par la cellule anti-terroriste :


Elasticsearch (NoSQL - Non Relationnel) : Fait office de témoin oculaire et de boîte noire réseau. Il stocke les logs bruts normalisés (`siem-logs-bruts`) sous forme de documents JSON à schéma dynamique (ex: adresses IP, volumes de données, timestamps). C'est sur ce moteur que l'IA UEBA effectue ses requêtes de détection.

PostgreSQL (SQL - Relationnel) :Fait office d'archiviste officiel et de référentiel métier strict. Il stocke les comptes des analystes SOC, la configuration RBAC des rôles, les règles de corrélation statiques et le registre officiel des alertes validées par le modèle d'IA ou les analystes.



🗃️ 2. Structure du Modèle Relationnel (PostgreSQL)


Conformément au diagramme de classes et aux exigences du cahier des charges (MFA, RBAC, Intégrité), la base de données PostgreSQL est structurée autour des entités clés suivantes :


A. Gestion des Utilisateurs et Sécurité (RBAC \& MFA)

Utilisateur (User) :Représente les analystes du SOC (ex: Chloe O'Brian, Edgar Stiles). Contient les informations de connexion, le hash du mot de passe et la clé secrète MFA (TOTP) obligatoire.

Rôle :Gère la ségrégation des responsabilités (RBAC) : `Lecteur`, `Analyste`, `Administrateur`. Un lecteur ne peut pas modifier les règles de corrélation ou déclencher des playbooks SOAR.



B. Moteur de Corrélation et Gestion des Incidents

RegleCorrelation (CorrelationRule) :Contient la définition des signatures de détection (ex: Seuil, Fenêtre temporelle glissante, Tactique MITRE ATT\&CK comme \*Initial Access\* ou \*Exfiltration\*).

Alerte (Alert) : Générée automatiquement en temps réel par le moteur de corrélation ou l'IA UEBA (ex: tentative de brute-force SSH de Chloe, exfiltration massive de Nina Myers). Liée à un niveau de criticité (`INFO`, `WARNING`, `HIGH`, `CRITICAL`).

Incident :Représente l'enquête de sécurité ouverte à la suite d'une ou plusieurs alertes. Contient un cycle de vie strict : Statut (`OUVERT`, `EN\_COURS`, `RESOLU`), journalisation des actions et assignation à un analyste.

Equipement (Asset) :Inventaire des composants de la infrastructure de la CTU (Postes opérateurs, Serveurs de fichiers, Firewalls) pour contextualiser les alertes (ex: liaison `id\_equipement INTEGER NOT NULL REFERENCES equipement(id) ON DELETE CASCADE`).




💻 3. Contenu et Rôle des Fichiers de ce Dossier


models.py` : Déclaration des classes Python (Modèles ORM via SQLAlchemy ou Tortoise ORM) définissant la structure exacte des tables PostgreSQL, leurs types et leurs contraintes d'intégrité (clés primaires, étrangères, indexations).

`init\_db.py` : Script d'amorçage automatique permettant de créer les tables sur PostgreSQL à partir des modèles, de purger l'ancienne base et d'insérer le jeu de données initial (comptes de test de la CTU, règles de corrélation MITRE standard).

`README.md` : Le présent guide explicatif (l'ancienne documentation obsolète de PgAdmin incluant la table `BATIMENT` a été définitivement supprimée).



