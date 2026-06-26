⏱️ Contexte Opérationnel : 24 Heures pour Agir

Inspiré des exigences de haute disponibilité et de réactivité d'une cellule anti-terroriste, le Smart SIEM est une plateforme logicielle multi-composants conçue pour collecter, normaliser, corréler et analyser les données de sécurité réseau en temps réel.

Contrairement à un SIEM classique passif, le Smart SIEM intègre un Moteur de Corrélation actif, un module de réponse automatisée SOAR (blocage de comptes, isolation de machines) et un moteur d'intelligence artificielle UEBA (User and Entity Behavior Analytics) capable de détecter les menaces internes sophistiquées (exfiltration lente de Nina Myers, mouvement latéral de Tony Almeida).



 🏗️ 1. Architecture Globale du Système

Le projet s'articule autour d'une architecture conteneurisée et modulaire répartie en 4 grands blocs :


[ VM / Équipements Réseau / Agents ] ───➔ (Logs Bruts : JSON/Syslog UDP)
                     │
                     ▼
             [ LOGSTASH (Port 514) ]  <── Pipeline de normalisation
                     │
                     ▼
          [ ELASTICSEARCH (NoSQL) ]   <── Témoin oculaire / Boîte noire
            ▲                  ▲
            │ (Query logs)     │ (Visualisation)
            │                  ▼
    [ MOTEUR IA UEBA ]   [ KIBANA ]   <── Dashboard RSSI & Room Crise (5s)
            │
            ▼ (Alertes Confirmées)
         [ POSTGRESQL (SQL) ] ◄───► [ BACKEND REST API ] ◄───► [ FRONTEND ]
         (Comptes, Alertes, RBAC)       (FastAPI / Core)         (Interface SOC)


1. Ingestion & Collecte (`/agents`) : Simulateurs de trafic avancé reproduisant les flux réels de la CTU et les scénarios d'attaques (Brute-force SSH, Exfiltration). Supporte l'envoi de structures JSON via API ou de flux textuels Syslog (RFC 5424) via UDP port 514.
2. Stockage & Indexation Hybride (`/database`) : Modèle combinant la vélocité d'Elasticsearch (indexation et recherche analytique en < 3s sur les documents de logs) et la rigueur relationnelle de PostgreSQL pour la gestion des utilisateurs, des logs d'audit et du suivi des alertes.
3. Moteur Analytique Backend (`/backend`) :** API REST propulsant la logique métier du SIEM, l'authentification avec sécurité **MFA (TOTP)** obligatoire, le contrôle des accès basé sur les rôles (**RBAC**), et le moteur de corrélation temporelle glissante.
4. Interface Graphique (`/frontend`) :** Tableaux de bord interactifs proposant plusieurs profils de visualisation (Analyste SOC technique, vue synthétique RSSI, et mode *Crisis Room* plein écran à rafraîchissement 5 secondes).

---

 ⚔️ 2. Scénarios de Menaces MITRE ATT&CK Couverts

Le Smart SIEM est configuré pour détecter automatiquement les attaques clés du cahier des charges :

* **Initial Access (TA0001) - Brute Force (T1110) [Scénario Chloe] :** Détection de 5 échecs d'authentification consécutifs en moins de 60 secondes sur une même cible. Déclenche un playbook SOAR de blocage d'IP.
* **Lateral Movement (TA0008) - Pass-the-Hash (T1550) [Scénario Tony] :** Identification d'authentifications NTLM inhabituelles ou asynchrones entre deux postes internes de la CTU.
* **Exfiltration (TA0010) - Exfiltration over C2 (T1041) [Scénario Nina Myers] :** Analyse comportementale par l'IA UEBA (via l'algorithme *Isolation Forest*). Elle détecte qu'une analyste légitime télécharge un volume de données > 10x la baseline en dehors des horaires habituels (ex : 2h47 du matin).

---

## 🛠️ 3. Guide de Démarrage Rapide (Environnement Équipe)

### Prérequis

* Docker Desktop & Docker Compose v2+
* Python 3.11+

### Étape A : Lancer l'Infrastructure Complète

À la racine du projet `siem-intelligent-1`, lancez l'ensemble des conteneurs en arrière-plan :

```powershell
docker compose up -d

```

*Cette commande initialise simultanément PostgreSQL, Elasticsearch, Kibana, Logstash, ainsi que le conteneur du Backend applicatif et PgAdmin.*

### Étape B : Initialiser la Base PostgreSQL

```powershell
python database/init_db.py

```

### Étape C : Lancer l'Agent d'Attaque pour Générer le Trafic

```powershell
python agents/attack_simulator.py

```

### Étape D : Activer le Moteur d'Intelligence Artificielle (UEBA)

Dans un terminal distinct :

```powershell
python backend/app/analytics/ueba_model.py

```

---

## 👥 4. Structure de Gouvernance de l'Équipe

Le projet est réparti selon une matrice de responsabilités inspirée du SOC de la CTU :

* **Chef de Projet / Analyste SOC Senior (Bill Buchanan) :** Validation fonctionnelle et mapping MITRE.
* **Développeur Backend (Edgar Stiles) :** API REST, logique SOAR et playbooks d'isolement.
* **Développeur Frontend / Data Viz (Chloe O'Brian) :** Conception du dashboard interactif et de la Crisis Room.
* **Ingénieur Infrastructure & DevOps (Jack Bauer / Aaron Pierce) :** Pipelines Logstash, résilience Docker, hardening TLS.
* **Ingénieur Data (Tony Almeida) :** Modélisation de la base PostgreSQL hybride et cycle de vie des données (rétention/SHA-256).
"""

# Let's save the database README

with open("database_README.md", "w", encoding="utf-8") as f:
f.write(readme_db_content)

# Let's save the project root README

with open("project_README.md", "w", encoding="utf-8") as f:
f.write(readme_root_content)

print("Files generated successfully!")

```
C'est parfait ! Grâce au cahier des charges officiel de votre école et à ton diagramme de classes, j'ai généré les deux documentations au format Markdown (`.md`) dont tu as besoin. 

Ils intègrent tous les éléments clés de l'univers de la CTU (Jack Bauer, Chloe O'Brian, Nina Myers), le fonctionnement hybride de vos bases de données (PostgreSQL pour la logique métier, Elasticsearch pour les logs), et les liaisons d'intégrité de ton schéma (comme la contrainte `id_equipement REFERENCES equipement(id) ON DELETE CASCADE`). 

L'ancienne documentation obsolète contenant la table `BATIMENT` est maintenant balayée et remplacée par ces guides professionnels.

---

### 📂 Vos fichiers README de production sont prêts

1. **Pour ton sous-dossier de base de données (`database/README.md`) :**
   [file-tag: code-generated-file-1-1782510609056684537]
   *Ce fichier explique en détail l'architecture de stockage hybride, le rôle des modèles SQLAlchemy/SQL, la gestion du RBAC, le MFA et les contraintes relationnelles des équipements de la CTU.*

2. **Pour la racine globale de ton projet de groupe (`README.md`) :**
   [file-tag: code-generated-file-0-1782510609056679274]
   *Ce fichier sert de vitrine et de guide de démarrage pour tes camarades de groupe et le jury. Il détaille le pipeline d'ingestion complet (Agents ➔ Logstash ➔ Elasticsearch ➔ PostgreSQL ➔ API Backend ➔ Frontend) ainsi que les scénarios d'attaques MITRE ATT&CK simulés (Chloe, Tony, Nina Myers).*

---

🚀 Comment les mettre en place dans ton projet et faire le Push ?

1. Ouvre ton projet **`siem-intelligent-1`** dans VS Code.
2. Ouvre le fichier `database/README.md` actuel (celui avec l'ancien schéma), efface tout et colle l'intégralité du contenu du fichier généré ci-dessus (**`database_README.md`**). Sauvegarde.
3. Crée ou ouvre le fichier `README.md` tout en bas à la racine de ton projet, et colle l'intégralité du contenu du fichier généré (**`project_README.md`**). Sauvegarde.
4. Glisse tes scripts de base de données (`models.py`, `init_db.py`) dans le dossier `database/`, ainsi que tes fichiers `docker-compose.yml` et `Dockerfile` à la racine.
5. Ouvre **GitHub Desktop** :
   * Tu verras tes fichiers modifiés de façon très propre. Ton fichier `.env` est masqué de manière totalement sécurisée grâce au `.gitignore`.
   * En bas à gauche, saisis ton message de commit : `Docs: Nettoyage complet de l'ancienne BDD et intégration du schéma Smart SIEM de la CTU`.
   * Clique sur **Commit to dev** puis sur **Push origin** en haut à droite.

Ton dépôt GitHub d'équipe est maintenant propre, sécurisé, documenté au niveau d'un standard de production et prêt pour l'intégration de votre modèle d'IA !

```