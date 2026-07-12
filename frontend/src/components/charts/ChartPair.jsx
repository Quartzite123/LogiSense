import { useState } from 'react'
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import GroupedBar from './GroupedBar.jsx'
import { axisProps, chartTheme, legendProps, tooltipProps, truncateLabel } from './chartTheme.js'

const CHART_TYPES = ['Bar', 'Line', 'Pie']
const PIE_COLORS = ['#FFD60A', '#60A5FA', '#4ADE80', '#F87171', '#A78BFA', '#94A3B8', '#FBBF24']

// payload: { data: [{ [xKey], ...metrics }], bars: [{ key, name?, color }], xKey, yUnit }
function BottomChart({ chartType, payload, height }) {
  const { data = [], bars = [], xKey = 'name', yUnit = '' } = payload || {}

  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-sm text-[#71717A]" style={{ height }}>
        No data for this dimension
      </div>
    )
  }

  if (chartType === 'Bar') {
    // GroupedBar renders one colored <Bar> per series → fixes the all-yellow bug.
    return <GroupedBar data={data} bars={bars} xKey={xKey} yUnit={yUnit} angledLabels height={height} />
  }

  if (chartType === 'Line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 16 }}>
          <CartesianGrid stroke={chartTheme.grid} vertical={false} />
          <XAxis dataKey={xKey} {...axisProps} interval={0} tickFormatter={truncateLabel} angle={-40} textAnchor="end" height={120} />
          <YAxis {...axisProps} unit={yUnit} allowDecimals={false} />
          <Tooltip {...tooltipProps} />
          <Legend {...legendProps} />
          {bars.map((b) => (
            <Line key={b.key} type="monotone" dataKey={b.key} name={b.name || b.key} stroke={b.color} strokeWidth={2} dot={{ r: 3 }} animationDuration={chartTheme.animationDuration} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // Pie — single metric (first series).
  const key = bars[0]?.key || 'value'
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey={key} nameKey={xKey} innerRadius={60} outerRadius={100} paddingAngle={2} stroke="#0B0C0D" strokeWidth={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipProps} />
        <Legend {...legendProps} />
      </PieChart>
    </ResponsiveContainer>
  )
}

const selectClass = 'rounded-md border border-[#27272A] bg-[#15151A] px-2 py-1.5 text-sm text-[#F8F8F8]'

// UI_DESIGN_SPEC §3.3 — fixed top chart + selectable bottom chart + expand modal.
// seriesFor(dimension) returns a { data, bars, xKey, yUnit } payload.
export default function ChartPair({ topChart, seriesFor, dimensionOptions = [], title = '' }) {
  const [type, setType] = useState('Bar')
  const [dim, setDim] = useState(dimensionOptions[0] || '')
  const [expand, setExpand] = useState(false)

  const payload = seriesFor ? seriesFor(dim) : null

  return (
    <div className="rounded-xl border border-[#27272A] bg-[#0F0F11] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#F8F8F8]">{title}</h2>
        <button
          onClick={() => setExpand(true)}
          title="Expand"
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#71717A] hover:bg-[#1A1A1F] hover:text-[#F8F8F8]"
        >
          ⛶
        </button>
      </div>

      {topChart}

      <div className="my-4 h-px bg-[#1F1F23]" />

      <div className="mb-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-[#71717A]">
          Chart type
          <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
            {CHART_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-[#71717A]">
          Dimension
          <select value={dim} onChange={(e) => setDim(e.target.value)} className={selectClass}>
            {dimensionOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>

      <BottomChart chartType={type} payload={payload} height={340} />

      {expand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6" onClick={() => setExpand(false)}>
          <div
            className="flex flex-col rounded-2xl border border-[#27272A] bg-[#0F0F11] p-6"
            style={{ width: '90vw', height: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#F8F8F8]">{title} — {dim}</h3>
              <button onClick={() => setExpand(false)} className="text-[#71717A] hover:text-[#F8F8F8]" aria-label="Close">×</button>
            </div>
            <div className="flex-1">
              <BottomChart chartType={type} payload={payload} height="100%" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
