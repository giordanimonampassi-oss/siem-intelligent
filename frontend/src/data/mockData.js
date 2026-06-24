export const metrics = [
  {
    label: 'Alertes critiques',
    value: '3',
    caption: 'Actives maintenant',
    tone: 'critical',
  },
  {
    label: 'Alertes élevées',
    value: '12',
    caption: 'À qualifier',
    tone: 'warning',
  },
  {
    label: 'Logs / heure',
    value: '47,832',
    caption: 'Dernières 60 minutes',
    tone: 'accent',
  },
  {
    label: 'Systèmes surveillés',
    value: '24',
    caption: 'Noeuds actifs',
    tone: 'info',
  },
]

export const latestAlerts = [
  {
    severity: 'CRITIQUE',
    rule: 'Tentative de force brute',
    source: '192.168.1.142',
    time: '14:22:01',
    status: 'En attente',
  },
  {
    severity: 'ÉLEVÉE',
    rule: 'Sortie de données inhabituelle',
    source: '10.0.0.45',
    time: '14:19:44',
    status: 'En investigation',
  },
  {
    severity: 'MOYENNE',
    rule: 'Élévation de privilèges',
    source: '172.16.5.12',
    time: '14:15:30',
    status: 'Qualification',
  },
  {
    severity: 'FAIBLE',
    rule: 'Scan de ports suspect',
    source: '88.14.22.101',
    time: '14:12:05',
    status: 'Clôturée',
  },
  {
    severity: 'CRITIQUE',
    rule: 'Heuristique ransomware',
    source: '10.0.4.21',
    time: '14:05:12',
    status: 'En attente',
  },
]

export const liveAlerts = [
  {
    severity: 'ÉLEVÉE',
    technique: 'T1566.001',
    id: 'AL-94285',
    title: "Collecteur d'identifiants détecté",
    description:
      "L'analyse du contrôleur de domaine signale un script PowerShell suspect depuis le marketing.",
    fields: [
      ['Hôte source', 'WKSTN-MK-042'],
      ['Objet cible', 'LDAP://AD-CORP-01'],
      ['Hash du script', 'd41d8cd98f00b204e9800998ecf8427e'],
    ],
    confidence: 70,
  },
  {
    severity: 'MOYENNE',
    technique: 'T1071.001',
    id: 'AL-94290',
    title: 'Trafic web inhabituel',
    description:
      'Le filtrage sortant a détecté du trafic chiffré vers un domaine récemment enregistré.',
    fields: [
      ['IP source', '10.0.12.55'],
      ['Destination', 'api.cloud-updater.net'],
      ['Protocole', 'HTTPS / 443'],
    ],
    confidence: 45,
  },
  {
    severity: 'FAIBLE',
    technique: 'T1059.001',
    id: 'AL-94298',
    title: 'Violation de politique : exécution de script local',
    description:
      'Un script administratif local a été exécuté sur une machine non privilégiée.',
    fields: [
      ['Utilisateur', 'CORP\\j.smith'],
      ['Processus', 'powershell.exe'],
      ['Politique', 'Sec-042-Exec-Restrict'],
    ],
    confidence: 20,
  },
]

export const logRows = [
  ['2026-06-23 14:22:01.034', '192.168.1.45', 'WS-0092-ENG', 'Auth : échec', 'ÉLEVÉE'],
  ['2026-06-23 14:21:58.112', '10.0.4.120', 'SRV-DC-01', 'Sys : politique', 'CRITIQUE'],
  ['2026-06-23 14:21:45.882', '172.16.0.12', 'LB-EDGE-02', 'Réseau : flux', 'MOYENNE'],
  ['2026-06-23 14:21:42.000', '192.168.1.1', 'FIREWALL-HQ', 'Sécurité : blocage', 'FAIBLE'],
  ['2026-06-23 14:20:10.123', '192.168.5.1', 'APP-SRV-10', 'App : log', 'FAIBLE'],
  ['2026-06-23 14:20:11.123', '192.168.5.2', 'APP-SRV-11', 'App : log', 'FAIBLE'],
  ['2026-06-23 14:20:12.123', '192.168.5.3', 'APP-SRV-12', 'App : log', 'FAIBLE'],
]

export const incidents = [
  {
    id: 'INC-0047',
    title: "Collecte d'identifiants : HR-VPC",
    description: 'Plusieurs échecs de connexion suivis d’un accès privilégié réussi.',
    severity: 'CRITIQUE',
    age: 'Il y a 12 min',
  },
  {
    id: 'INC-0046',
    title: 'Exécution PowerShell suspecte',
    description: 'Commande encodée exécutée sur DB-PROD-01.',
    severity: 'ÉLEVÉE',
    age: 'Il y a 1 h',
  },
  {
    id: 'INC-0045',
    title: 'Scan de ports détecté',
    description: 'Trafic entrant depuis des plages IP malveillantes connues.',
    severity: 'MOYENNE',
    age: 'Il y a 3 h',
  },
]

export const playbooks = [
  ['Bloquer l’IP au périmètre', 'Exécuté', 'SOAR-AX-991'],
  ['Désactiver le compte utilisateur', 'En attente d’approbation', 'svc-hr-payroll'],
  ['Envoyer l’escalade', 'Envoyée', 'Groupe réponse niveau 3'],
]

export const users = [
  ['Alex Sokolov', 'alex.s@siem.internal', 'SUPER ADMIN', 'Activée', '2026-06-23 14:22:10'],
  ['Maya Rodriguez', 'm.rodriguez@siem.internal', 'ANALYSTE N2', 'Activée', '2026-06-23 09:15:44'],
  ['Jordan Holt', 'jholt@siem.internal', 'LECTURE SEULE', 'En attente', '2026-06-22 18:45:02'],
]
