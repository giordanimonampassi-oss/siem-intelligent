import React from 'react'
import { FiAlertTriangle, FiAlertCircle, FiInfo } from 'react-icons/fi'

const icons = {
  danger:  <FiAlertCircle  style={{ color: 'var(--sev-critical)', fontSize: '2.5rem' }} />,
  warning: <FiAlertTriangle style={{ color: 'var(--sev-warning)', fontSize: '2.5rem' }} />,
  info:    <FiInfo         style={{ color: 'var(--sev-info)',     fontSize: '2.5rem' }} />,
}

export default function ConfirmDialog({
  isOpen, title, message, confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler', type = 'warning',
  onConfirm, onCancel,
}) {
  if (!isOpen) return null

  return (
    <div className="custom-alert-overlay" onClick={onCancel}>
      <div className="custom-alert" onClick={e => e.stopPropagation()}>
        <div className="custom-alert-icon">{icons[type]}</div>
        <div className="custom-alert-title">{title}</div>
        <div className="custom-alert-message">{message}</div>
        <div className="custom-alert-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}