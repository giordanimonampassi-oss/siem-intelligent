import React from 'react'
import { FiDatabase } from 'react-icons/fi'

// ── Badge criticité / statut / rôle ───────────────────────────────────────
export function Badge({ value, pulse }) {
  return (
    <span className={`badge ${value} ${pulse ? 'pulse' : ''}`}>
      {value}
    </span>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────
export function Skeleton({ width = '100%', height = 16, style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: 4, ...style }}
    />
  )
}

export function SkeletonRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}><Skeleton /></td>
      ))}
    </tr>
  )
}

// ── État vide ─────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {icon || <FiDatabase />}
      </div>
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

// ── Panneau latéral détail ────────────────────────────────────────────────
export function SidePanel({ isOpen, onClose, title, children }) {
  return (
    <>
      {isOpen && <div className="side-panel-overlay" onClick={onClose} />}
      <div className={`side-panel ${isOpen ? 'open' : ''}`}>
        <div className="side-panel-header">
          <strong>{title}</strong>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="side-panel-body">{children}</div>
      </div>
    </>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub, color = 'teal', icon, trend }) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${color}`}>{value}</div>
      {sub && (
        <div className="kpi-sub">
          {trend === 'up'   && <span className="kpi-trend-up">↑</span>}
          {trend === 'down' && <span className="kpi-trend-down">↓</span>}
          {sub}
        </div>
      )}
      {icon && <div className="kpi-icon">{icon}</div>}
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────
export function Card({ title, actions, children, style = {} }) {
  return (
    <div className="card" style={style}>
      {(title || actions) && (
        <div className="card-header">
          {title && <div className="card-title">{title}</div>}
          {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────
export function Pagination({ page, total, size, onChange }) {
  const totalPages = Math.ceil(total / size)
  if (totalPages <= 1) return null

  const pages = []
  const delta = 2
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    pages.push(i)
  }

  return (
    <div className="pagination">
      <button
        className="page-btn"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
      >←</button>

      {pages[0] > 1 && (
        <>
          <button className="page-btn" onClick={() => onChange(1)}>1</button>
          {pages[0] > 2 && <span style={{ color: 'var(--text-muted)', padding: '0 4px' }}>…</span>}
        </>
      )}

      {pages.map(p => (
        <button
          key={p}
          className={`page-btn ${p === page ? 'active' : ''}`}
          onClick={() => onChange(p)}
        >{p}</button>
      ))}

      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && (
            <span style={{ color: 'var(--text-muted)', padding: '0 4px' }}>…</span>
          )}
          <button className="page-btn" onClick={() => onChange(totalPages)}>
            {totalPages}
          </button>
        </>
      )}

      <button
        className="page-btn"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
      >→</button>

      <span className="page-info">
        {((page - 1) * size) + 1}–{Math.min(page * size, total)} / {total}
      </span>
    </div>
  )
}