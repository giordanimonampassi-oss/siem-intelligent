const severityClasses = {
  CRITIQUE: 'critical',
  CRITICAL: 'critical',
  ÉLEVÉE: 'high',
  ELEVEE: 'high',
  HIGH: 'high',
  MOYENNE: 'medium',
  MEDIUM: 'medium',
  FAIBLE: 'low',
  LOW: 'low',
  INFO: 'info',
  AVERTISSEMENT: 'warning',
  WARNING: 'warning',
}

export function severityClass(severity) {
  return severityClasses[severity] ?? severity.toLowerCase()
}
