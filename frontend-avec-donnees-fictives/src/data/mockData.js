export const SEVERITY = {
  CRITICAL: { label: 'CRITICAL', color: '#f85149', bg: 'rgba(248,81,73,0.15)' },
  HIGH: { label: 'HIGH', color: '#d29922', bg: 'rgba(210,153,34,0.15)' },
  WARNING: { label: 'WARNING', color: '#e3b341', bg: 'rgba(227,179,65,0.15)' },
  INFO: { label: 'INFO', color: '#58a6ff', bg: 'rgba(88,166,255,0.15)' },
};

export const INCIDENTS = [
  {
    id: 'INC-2026-0314',
    title: 'Compte dormant activé + exfiltration Pentagone',
    severity: 'CRITICAL',
    status: 'ouvert',
    createdAt: '2026-03-14 06:14:37',
    assignedTo: "Chloe O'Brian",
    rule: 'COR-003 — Pattern multi-sources CTU',
    mitre: 'T1078 — Valid Accounts',
    entities: { ip: '178.43.12.87', user: 'CTU-SVC-003', host: 'srv-pentagon-01' },
    confidence: 94,
    soarActions: [
      { action: 'Désactivation compte CTU-SVC-003', status: 'succès', time: '06:14:40' },
      { action: 'Blocage IP 178.43.12.87', status: 'succès', time: '06:14:44' },
      { action: 'Notification Jack Bauer (SMS)', status: 'succès', time: '06:14:55' },
    ],
    logs: [
      '[06:14:12] SSH auth failed x5 from 178.43.12.87 → target srv-pentagon-01',
      '[06:14:37] Windows auth SUCCESS — user CTU-SVC-003 from 10.0.4.22',
      '[06:14:38] Data transfer 847 MB outbound — srv-pentagon-01 → 178.43.12.87',
      '[06:14:37] Badge access — dormant account CTU-SVC-003 activated',
    ],
  },
  {
    id: 'INC-2026-0312',
    title: 'Brute-force SSH depuis Douala',
    severity: 'HIGH',
    status: 'en_cours',
    createdAt: '2026-03-14 06:12:05',
    assignedTo: 'Jack Bauer',
    rule: 'COR-001 — Brute Force SSH (T1110)',
    mitre: 'T1110 — Brute Force',
    entities: { ip: '178.43.12.87', user: null, host: 'fw-perimeter-01' },
    confidence: 78,
    soarActions: [{ action: 'Blocage IP temporaire', status: 'en cours', time: '06:12:30' }],
    logs: [
      '[06:11:20] SSH auth failed from 178.43.12.87',
      '[06:11:35] SSH auth failed from 178.43.12.87',
      '[06:11:50] SSH auth failed from 178.43.12.87',
      '[06:12:05] Threshold 5/5 — rule COR-001 triggered',
    ],
  },
  {
    id: 'INC-2026-0307',
    title: 'Anomalie UEBA — Nina Myers 03h47',
    severity: 'CRITICAL',
    status: 'résolu',
    createdAt: '2026-03-07 03:05:12',
    assignedTo: "Chloe O'Brian",
    rule: 'UEBA-002 — Connexion hors horaires + exfiltration',
    mitre: 'T1041 — Exfiltration Over C2',
    entities: { ip: '10.0.2.15', user: 'n.myers', host: 'srv-archives-01' },
    confidence: 94,
    soarActions: [
      { action: 'Alerte CRITICAL générée', status: 'succès', time: '03:05:12' },
      { action: 'Notification Jack Bauer', status: 'succès', time: '03:05:18' },
      { action: 'Badge révoqué — sortie bâtiment', status: 'succès', time: '03:08:00' },
    ],
    logs: [
      '[02:47] Badge access — n.myers — server room',
      '[02:53] File download x840 — srv-archives-01',
      '[03:01] Access denied — encrypted partition /vault',
      '[03:05] UEBA score 94 — alert escalated CRITICAL',
    ],
  },
  {
    id: 'INC-2026-0310',
    title: 'Mouvement latéral NTLM interne',
    severity: 'HIGH',
    status: 'en_cours',
    createdAt: '2026-03-10 23:47:00',
    assignedTo: 'Tony Almeida',
    rule: 'COR-002 — Pass-the-Hash (T1550)',
    mitre: 'T1550 — Use Alternate Authentication',
    entities: { ip: '10.0.3.44', user: 'svc_backup', host: 'ws-analyst-12' },
    confidence: 82,
    soarActions: [],
    logs: [
      '[23:47] NTLM auth unusual — ws-analyst-12 → srv-dc-01',
      '[23:48] Lateral movement detected — segment B',
    ],
  },
  {
    id: 'INC-2026-0318',
    title: 'Tentative accès classifié — IP Douala',
    severity: 'WARNING',
    status: 'ouvert',
    createdAt: '2026-03-18 14:22:00',
    assignedTo: 'Tony Almeida',
    rule: 'COR-004 — Geo-anomaly access',
    mitre: 'T1078 — Valid Accounts',
    entities: { ip: '41.202.219.55', user: 'unknown', host: 'vpn-gateway' },
    confidence: 45,
    soarActions: [],
    logs: ['[14:22] VPN connection attempt from 41.202.219.55 (Douala, CM)'],
  },
  {
    id: 'INC-2026-0320',
    title: 'Service journalisation arrêté',
    severity: 'HIGH',
    status: 'ouvert',
    createdAt: '2026-03-20 02:15:00',
    assignedTo: "Chloe O'Brian",
    rule: 'COR-005 — Log Deletion (T1070)',
    mitre: 'T1070 — Indicator Removal',
    entities: { ip: '10.0.5.88', user: 'SYSTEM', host: 'ws-field-07' },
    confidence: 71,
    soarActions: [{ action: 'Playbook CONFIRM — attente analyste', status: 'en attente', time: '02:15:05' }],
    logs: ['[02:15] Windows Event — service EventLog stopped on ws-field-07'],
  },
];

export const LOG_VOLUME_24H = [
  { hour: '00h', volume: 1240 },
  { hour: '02h', volume: 890 },
  { hour: '04h', volume: 720 },
  { hour: '06h', volume: 4850 },
  { hour: '08h', volume: 3200 },
  { hour: '10h', volume: 2800 },
  { hour: '12h', volume: 3100 },
  { hour: '14h', volume: 2650 },
  { hour: '16h', volume: 2900 },
  { hour: '18h', volume: 2400 },
  { hour: '20h', volume: 1800 },
  { hour: '22h', volume: 1500 },
];

export const TOP_SOURCE_IPS = [
  { ip: '178.43.12.87', events: 847, country: 'CH', risk: 'critical' },
  { ip: '41.202.219.55', events: 234, country: 'CM', risk: 'high' },
  { ip: '10.0.4.22', events: 189, country: 'INT', risk: 'high' },
  { ip: '185.220.101.42', events: 156, country: 'DE', risk: 'medium' },
  { ip: '10.0.2.15', events: 142, country: 'INT', risk: 'critical' },
];

export const FORENSIC_LOGS = [
  { id: 1, timestamp: '2026-03-14 06:14:37', sourceIp: '178.43.12.87', user: 'CTU-SVC-003', host: 'srv-pentagon-01', type: 'auth', severity: 'critical', message: 'Windows authentication SUCCESS after 5 SSH failures' },
  { id: 2, timestamp: '2026-03-14 06:14:38', sourceIp: '10.0.4.22', user: 'CTU-SVC-003', host: 'srv-pentagon-01', type: 'réseau', severity: 'critical', message: 'Outbound transfer 847 MB to 178.43.12.87' },
  { id: 3, timestamp: '2026-03-14 06:12:05', sourceIp: '178.43.12.87', user: null, host: 'fw-perimeter-01', type: 'auth', severity: 'high', message: 'SSH brute-force threshold reached (5/5 in 60s)' },
  { id: 4, timestamp: '2026-03-14 06:11:50', sourceIp: '178.43.12.87', user: 'root', host: 'srv-pentagon-01', type: 'auth', severity: 'warning', message: 'SSH authentication failed — invalid credentials' },
  { id: 5, timestamp: '2026-03-14 06:11:35', sourceIp: '178.43.12.87', user: 'root', host: 'srv-pentagon-01', type: 'auth', severity: 'warning', message: 'SSH authentication failed — invalid credentials' },
  { id: 6, timestamp: '2026-03-14 06:10:22', sourceIp: '178.43.12.87', user: null, host: 'fw-perimeter-01', type: 'réseau', severity: 'info', message: 'Port scan detected — ports 22,80,443,3389' },
  { id: 7, timestamp: '2026-03-14 06:09:15', sourceIp: '178.43.12.87', user: null, host: 'vpn-gateway', type: 'réseau', severity: 'info', message: 'Connection established from external IP' },
  { id: 8, timestamp: '2026-03-07 03:01:00', sourceIp: '10.0.2.15', user: 'n.myers', host: 'srv-archives-01', type: 'auth', severity: 'critical', message: 'Access denied — encrypted partition /vault' },
  { id: 9, timestamp: '2026-03-07 02:53:00', sourceIp: '10.0.2.15', user: 'n.myers', host: 'srv-archives-01', type: 'application', severity: 'high', message: 'Bulk download 840 files in 12 minutes' },
  { id: 10, timestamp: '2026-03-07 02:47:00', sourceIp: '10.0.2.15', user: 'n.myers', host: 'srv-archives-01', type: 'auth', severity: 'high', message: 'Badge access server room — outside normal hours' },
];

export const CORRELATION_RULES = [
  { id: 'COR-001', name: 'Brute Force SSH', type: 'threshold', mitre: 'T1110', status: 'active', threshold: 5, window: '60s', severity: 'HIGH', triggers7d: 47, description: '5 échecs SSH en 60s sur la même cible', sources: ['Linux', 'Firewall'] },
  { id: 'COR-002', name: 'Pass-the-Hash interne', type: 'pattern', mitre: 'T1550', status: 'active', threshold: null, window: '120s', severity: 'HIGH', triggers7d: 12, description: 'Auth NTLM inhabituelle entre 2 postes internes', sources: ['AD', 'Endpoint'] },
  { id: 'COR-003', name: 'Kill-chain CTU multi-sources', type: 'pattern', mitre: 'T1078', status: 'active', threshold: null, window: '180s', severity: 'CRITICAL', triggers7d: 3, description: 'SSH fail → auth Windows → exfiltration + badge dormant', sources: ['Firewall', 'AD', 'Badge'] },
  { id: 'COR-004', name: 'Geo-anomaly VPN', type: 'threshold', mitre: 'T1078', status: 'active', threshold: 1, window: '300s', severity: 'WARNING', triggers7d: 28, description: 'Connexion VPN depuis pays non autorisé', sources: ['VPN'] },
  { id: 'COR-005', name: 'Suppression logs (T1070)', type: 'threshold', mitre: 'T1070', status: 'active', threshold: 1, window: '60s', severity: 'HIGH', triggers7d: 5, description: 'Arrêt service EventLog sur endpoint', sources: ['Windows'] },
  { id: 'COR-006', name: 'Exfiltration volume anormal', type: 'threshold', mitre: 'T1041', status: 'inactive', threshold: 10, window: '900s', severity: 'CRITICAL', triggers7d: 0, description: 'Volume sortant > 10x baseline sur 15 min', sources: ['Network', 'UEBA'] },
];

export const UEBA_ENTITIES = [
  { id: 'n.myers', name: 'Nina Myers', type: 'utilisateur', riskScore: 94, trend: 'up', department: 'Analyse CTU' },
  { id: 'j.martin', name: 'j.martin', type: 'utilisateur', riskScore: 23, trend: 'stable', department: 'Réseau' },
  { id: 'CTU-SVC-003', name: 'CTU-SVC-003', type: 'compte service', riskScore: 88, trend: 'up', department: 'Infrastructure' },
  { id: 'ws-analyst-12', name: 'ws-analyst-12', type: 'machine', riskScore: 67, trend: 'up', department: 'Analystes' },
  { id: 'srv-pentagon-01', name: 'srv-pentagon-01', type: 'serveur', riskScore: 91, trend: 'up', department: 'Classifié' },
];

export const UEBA_PROFILE = {
  entity: 'n.myers',
  name: 'Nina Myers',
  type: 'utilisateur',
  riskScore: 94,
  baseline: {
    usualHours: '07:30 — 18:00 (lun-ven)',
    avgLogins: '4.2 / jour',
    avgDataVolume: '120 MB / jour',
    usualResources: ['dossiers-op-12', 'rapports-hebdo', 'intranet-ctu'],
    clearance: 'Maximum',
  },
  anomalies: [
    { date: '2026-03-07 02:47', type: 'Horaire inhabituel', detail: 'Connexion à 02:47 — jamais avant 07:30 en 3 ans', scoreImpact: '+25' },
    { date: '2026-03-07 02:53', type: 'Volume anormal', detail: '840 fichiers téléchargés en 12 min (baseline: 12/jour)', scoreImpact: '+22' },
    { date: '2026-03-07 03:01', type: 'Accès hors périmètre', detail: 'Tentative partition /vault — jamais accédée', scoreImpact: '+31' },
    { date: '2026-03-07 03:05', type: 'Corrélation alerte', detail: 'Score UEBA > 50 + alerte réseau → escalade CRITICAL', scoreImpact: '+16' },
  ],
  scoreHistory: [
    { day: 'Lun', score: 12 },
    { day: 'Mar', score: 12 },
    { day: 'Mer', score: 14 },
    { day: 'Jeu', score: 12 },
    { day: 'Ven', score: 13 },
    { day: 'Sam', score: 12 },
    { day: 'Dim', score: 94 },
  ],
};

export const REPORTS = [
  { id: 'RPT-D-0324', name: 'Rapport quotidien — 24/03/2026', type: 'quotidien', date: '2026-03-25 00:00', status: 'disponible', size: '2.4 MB' },
  { id: 'RPT-D-0323', name: 'Rapport quotidien — 23/03/2026', type: 'quotidien', date: '2026-03-24 00:00', status: 'disponible', size: '2.1 MB' },
  { id: 'RPT-W-12', name: 'Rapport hebdomadaire — Semaine 12', type: 'hebdomadaire', date: '2026-03-24 00:00', status: 'disponible', size: '8.7 MB' },
  { id: 'RPT-W-11', name: 'Rapport hebdomadaire — Semaine 11', type: 'hebdomadaire', date: '2026-03-17 00:00', status: 'disponible', size: '7.9 MB' },
  { id: 'RPT-CUSTOM-01', name: 'Audit incident 14/03 — Tony Almeida', type: 'personnalisé', date: '2026-03-15 14:30', status: 'disponible', size: '4.2 MB' },
];

export const AUDIT_LOG = [
  { time: '2026-03-25 07:02', user: 'Aaron Pierce', action: 'Modification règle COR-003 — fenêtre 180s', ip: '10.0.1.5' },
  { time: '2026-03-25 06:58', user: 'Bill Buchanan', action: 'Consultation vue RSSI', ip: '10.0.1.12' },
  { time: '2026-03-25 06:14', user: "Chloe O'Brian", action: 'Ouverture incident INC-2026-0314', ip: '10.0.1.8' },
  { time: '2026-03-25 06:12', user: "Chloe O'Brian", action: 'Connexion MFA validée', ip: '10.0.1.8' },
  { time: '2026-03-24 23:47', user: 'Jack Bauer', action: 'Exécution playbook — blocage IP', ip: '41.202.219.55' },
  { time: '2026-03-24 18:00', user: 'Aaron Pierce', action: 'Création utilisateur test.demo@ctu.gov', ip: '10.0.1.5' },
];

export const RSSI_KPIS = {
  incidents7d: 23,
  incidentsTrend: -12,
  mttr: '4h 32min',
  mttrTrend: -8,
  complianceISO: 94,
  complianceRGPD: 91,
  rulesTriggered: 156,
  falsePositiveRate: 4.2,
};

export const TOP_RULES_7D = [
  { name: 'Brute Force SSH', count: 47 },
  { name: 'Geo-anomaly VPN', count: 28 },
  { name: 'Pass-the-Hash interne', count: 12 },
  { name: 'Suppression logs', count: 5 },
  { name: 'Kill-chain CTU', count: 3 },
];

export const INCIDENT_TREND_7D = [
  { day: 'Lun', critical: 1, high: 3, warning: 5 },
  { day: 'Mar', critical: 0, high: 2, warning: 4 },
  { day: 'Mer', critical: 2, high: 4, warning: 6 },
  { day: 'Jeu', critical: 0, high: 1, warning: 3 },
  { day: 'Ven', critical: 1, high: 2, warning: 4 },
  { day: 'Sam', critical: 0, high: 1, warning: 2 },
  { day: 'Dim', critical: 0, high: 0, warning: 1 },
];
