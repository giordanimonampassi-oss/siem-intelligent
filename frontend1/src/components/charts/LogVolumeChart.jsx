import React from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useTranslation } from 'react-i18next'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      border: '1px solid var(--border-color)',
      borderRadius: 8, padding: '10px 14px',
      fontSize: '0.8rem',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', gap: 8 }}>
          <span>{p.name}</span>
          <strong>{p.value?.toLocaleString()}</strong>
        </div>
      ))}
    </div>
  )
}

export default function LogVolumeChart({ data = [] }) {
  const { t } = useTranslation()

  // Génère des données simulées si vide
  const chartData = data.length > 0 ? data : Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}h`,
    total:    Math.floor(1200 + Math.random() * 3000),
    critical: Math.floor(5  + Math.random() * 40),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="var(--accent-teal)"  stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--accent-teal)"  stopOpacity={0}   />
          </linearGradient>
          <linearGradient id="gradCrit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="var(--sev-critical)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="var(--sev-critical)" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          tickLine={false} axisLine={false}
          interval={3}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          tickLine={false} axisLine={false}
          tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '0.78rem', color: 'var(--text-muted)', paddingTop: 8 }}
        />
        <Area
          type="monotone" dataKey="total" name="Total"
          stroke="var(--accent-teal)" strokeWidth={2}
          fill="url(#gradTotal)"
        />
        <Area
          type="monotone" dataKey="critical" name="Critique"
          stroke="var(--sev-critical)" strokeWidth={1.5}
          fill="url(#gradCrit)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}