import { SEVERITY } from '../data/mockData';

export default function SeverityBadge({ severity, size = 'md' }) {
  const config = SEVERITY[severity] || SEVERITY.INFO;
  return (
    <span
      className={`badge badge-${size}`}
      style={{ color: config.color, backgroundColor: config.bg, borderColor: config.color }}
    >
      {config.label}
    </span>
  );
}

export function StatusBadge({ status }) {
  const map = {
    ouvert: { label: 'Ouvert', cls: 'status-open' },
    en_cours: { label: 'En cours', cls: 'status-progress' },
    résolu: { label: 'Résolu', cls: 'status-resolved' },
    actif: { label: 'Actif', cls: 'status-active' },
    inactif: { label: 'Inactif', cls: 'status-inactive' },
  };
  const s = map[status] || { label: status, cls: '' };
  return <span className={`status-badge ${s.cls}`}>{s.label}</span>;
}

export function RoleBadge({ role }) {
  const map = {
    Lecteur: 'role-reader',
    Analyste: 'role-analyst',
    Administrateur: 'role-admin',
  };
  return <span className={`role-badge ${map[role] || ''}`}>{role}</span>;
}
