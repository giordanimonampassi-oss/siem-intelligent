import { ROLES } from '../data/users';

const ALL_ROUTES = [
  { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', roles: [ROLES.LECTEUR, ROLES.ANALYSTE, ROLES.ADMIN] },
  { path: '/alertes', label: 'Alertes & Incidents', icon: 'AlertTriangle', roles: [ROLES.ANALYSTE, ROLES.ADMIN] },
  { path: '/forensique', label: 'Recherche forensique', icon: 'Search', roles: [ROLES.ANALYSTE, ROLES.ADMIN] },
  { path: '/crisis-room', label: 'Crisis Room', icon: 'Monitor', roles: [ROLES.LECTEUR, ROLES.ANALYSTE, ROLES.ADMIN] },
  { path: '/rssi', label: 'Vue RSSI', icon: 'BarChart3', roles: [ROLES.LECTEUR, ROLES.ANALYSTE, ROLES.ADMIN] },
  { path: '/ueba', label: 'Profil UEBA', icon: 'UserSearch', roles: [ROLES.ANALYSTE, ROLES.ADMIN] },
  { path: '/regles', label: 'Règles de corrélation', icon: 'GitBranch', roles: [ROLES.ANALYSTE, ROLES.ADMIN] },
  { path: '/admin', label: 'Administration RBAC', icon: 'Shield', roles: [ROLES.ADMIN] },
  { path: '/rapports', label: 'Rapports & Exports', icon: 'FileText', roles: [ROLES.LECTEUR, ROLES.ANALYSTE, ROLES.ADMIN] },
];

export function getNavItems(role) {
  return ALL_ROUTES.filter((r) => r.roles.includes(role));
}

export function getDefaultRoute(role) {
  if (role === ROLES.LECTEUR) return '/rssi';
  return '/dashboard';
}

export function canAccess(role, path) {
  const item = ALL_ROUTES.find((r) => r.path === path);
  if (!item) return path === '/403';
  return item.roles.includes(role);
}

export function canAccessRawLogs(role) {
  return role === ROLES.ANALYSTE || role === ROLES.ADMIN;
}

export function canManageUsers(role) {
  return role === ROLES.ADMIN;
}

export function canModifyIncidents(role) {
  return role === ROLES.ANALYSTE || role === ROLES.ADMIN;
}
