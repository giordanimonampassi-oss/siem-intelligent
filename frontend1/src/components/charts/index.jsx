import React from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, AreaChart, Area,
} from 'recharts'

const COLORS = {
  AUTH:        'var(--accent-purple)',
  NETWORK:     'var(--accent-blue)',
  SYSTEM:      'var(--accent-teal)',
  APPLICATION: 'var(--sev-high)',
  CLOUD:       'var(--sev-success)',
}
const PIE_COLORS = ['var(--accent-purple)', 'var(--accent-blue)', 'var(--accent-teal)', 'var(--sev-high)', 'var(--sev-success)']

const TooltipBox = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
      borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem',
    }}>
      <div style={{ color: payload[0].color }}>{payload[0].name}</div>
      <strong>{payload[0].value?.toLocaleString()}</strong>
    </div>
  )
}

// ── Donut alertes par type ────────────────────────────────────────────────
export function AlertsDonutChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{
        height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center',
      }}>
        Aucune donnée sur cette période
      </div>
    )
  }
 
  const chartData = data
  const total = chartData.reduce((s, d) => s + d.value, 0)
 
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%" cy="50%"
          innerRadius={55} outerRadius={80}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => [`${v} (${total > 0 ? ((v / total) * 100).toFixed(0) : 0}%)`, '']}
          contentStyle={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 8, fontSize: '0.8rem',
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          iconType="circle" iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Top 10 IPs sources ────────────────────────────────────────────────────
// ── Top 10 IPs sources ────────────────────────────────────────────────────
export default function TopIPsChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ 
        padding: 40, 
        textAlign: 'center', 
        color: 'var(--text-muted)', 
        fontSize: '0.9rem' 
      }}>
        Aucune IP source détectée ces dernières 24h
      </div>
    )
  }

  const max = Math.max(...data.map(d => d.count), 1)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickLine={false} 
          axisLine={false}
        />
        <YAxis
          type="category" 
          dataKey="ip"
          tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'JetBrains Mono' }}
          tickLine={false} 
          axisLine={false}
          width={120}
        />
        <Tooltip 
          contentStyle={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
          }}
        />
        <Bar dataKey="count" name="Événements" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={i === 0 ? 'var(--sev-critical)' : i < 3 ? 'var(--sev-high)' : 'var(--accent-teal)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
// ── Incidents 30 jours (RSSI) ─────────────────────────────────────────────
export function IncidentsTrendChart({ data = [] }) {
  const chartData = data.length > 0 ? data : Array.from({ length: 30 }, (_, i) => ({
    day: `J${i + 1}`,
    incidents: Math.floor(Math.random() * 8),
    alerts:    Math.floor(5 + Math.random() * 25),
  }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickLine={false} axisLine={false}
          interval={4}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickLine={false} axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 8, fontSize: '0.8rem',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} />
        <Line
          type="monotone" dataKey="incidents" name="Incidents"
          stroke="var(--sev-critical)" strokeWidth={2} dot={false}
        />
        <Line
          type="monotone" dataKey="alerts" name="Alertes"
          stroke="var(--accent-teal)" strokeWidth={1.5} dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Score UEBA historique ─────────────────────────────────────────────────
export function UEBAScoreChart({ data = [] }) {
  const chartData = data.length > 0 ? data : Array.from({ length: 30 }, (_, i) => ({
    day: `J${i + 1}`,
    score: i < 20 ? 8 + Math.random() * 6 : 12 + (i - 20) * 15,
  }))

  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -30, bottom: 0 }}>
        <defs>
          <linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="var(--sev-critical)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="var(--sev-critical)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" hide />
        <YAxis domain={[0, 100]} hide />
        <Tooltip
          formatter={(v) => [Number(v).toFixed(1), 'Score']}
          contentStyle={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 8, fontSize: '0.78rem',
          }}
        />
        <Area
          type="monotone" dataKey="score"
          stroke="var(--sev-critical)" strokeWidth={2}
          fill="url(#gradScore)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Gauge circulaire RSSI ─────────────────────────────────────────────────
export function CircleGauge({ value, size = 100, color = 'var(--sev-success)' }) {
  const r  = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const fill = circ * (1 - value / 100)

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke="var(--bg-tertiary)" strokeWidth={8} />
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circ}
          strokeDashoffset={fill}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <span style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{value}%</span>
      </div>
    </div>
  )
}
// ── Export final ─────────────────────────────────────────────────────────────
export {

  TopIPsChart,           // ← Ajoute cette ligne


}