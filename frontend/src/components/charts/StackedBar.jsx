import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { axisProps, chartTheme, legendProps, tooltipProps } from './chartTheme.js'

// Stacked bar chart (UI_DESIGN_SPEC §3.2 — per-company monthly breakdown).
//   data: [{ [xKey]: 'Jan 2026', Early: 10, 'On Time': 4, Late: 2, ... }]
//   bars: [{ key, name?, color }]  (stack order = array order)
export default function StackedBar({ data = [], bars = [], xKey = 'month', height = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartTheme.grid} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} allowDecimals={false} />
        <Tooltip {...tooltipProps} />
        <Legend {...legendProps} />
        {bars.map((b, i) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.name || b.key}
            stackId="a"
            fill={b.color}
            radius={i === bars.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            isAnimationActive
            animationDuration={chartTheme.animationDuration}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
