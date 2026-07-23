// Shared Recharts theme (UI_DESIGN_SPEC §3.1). All section charts import these
// so axes, gridlines, tooltips and animation are identical everywhere.
import { tokens } from '../../styles/tokens.js'

export const chartTheme = {
  grid: tokens.borderSoft, // #1F1F23 — horizontal gridlines only
  axis: tokens.muted, // #8A8A93 — axis text
  tooltip: { bg: tokens.surface2, border: tokens.border, text: tokens.text },
  fontFamily: "'Inter', sans-serif",
  status: {
    early: tokens.early,
    onTime: tokens.onTime,
    onTimeAlt: '#A78BFA', // purple — On Time on the combo trend line
    late: tokens.late,
    rto: tokens.rto,
    pending: tokens.pending,
    notYet: tokens.notYet,
    primary: tokens.primary,
  },
  animationDuration: 300,
}

// Spread onto <Tooltip />.
export const tooltipProps = {
  contentStyle: {
    background: chartTheme.tooltip.bg,
    border: `1px solid ${chartTheme.tooltip.border}`,
    borderRadius: 8,
    fontSize: 12,
    color: chartTheme.tooltip.text,
  },
  itemStyle: { color: chartTheme.tooltip.text },
  labelStyle: { color: chartTheme.axis },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
}

// Spread onto <XAxis /> / <YAxis />.
export const axisProps = {
  tick: { fill: chartTheme.axis, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: tokens.border },
}

export const legendProps = {
  wrapperStyle: { fontSize: 12, color: chartTheme.axis },
}

// Truncate long category labels (e.g. company names) on a rotated X axis.
// The full value still appears in the tooltip (Recharts uses the raw datum,
// not the formatted tick, for the tooltip label).
export const truncateLabel = (name) =>
  typeof name === 'string' && name.length > 14 ? `${name.slice(0, 14)}…` : name
