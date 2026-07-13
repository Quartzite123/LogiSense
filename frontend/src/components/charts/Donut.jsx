import {
  Cell,
  Label,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { chartTheme, legendProps, tooltipProps } from './chartTheme.js'

// Donut chart (UI_DESIGN_SPEC §3.2). data: [{ name, value, color }].
// Optional centerLabel renders the total in the hole.
export default function Donut({ data = [], height = 320, centerLabel = 'total' }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0)

  return (
    <div style={{ padding: '16px 8px 8px 8px', overflow: 'visible' }}>
      <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={2}
          stroke={chartTheme.tooltip.text === '#F8F8F8' ? '#0B0C0D' : '#0B0C0D'}
          strokeWidth={2}
          isAnimationActive
          animationDuration={chartTheme.animationDuration}
          labelLine={false}
          label={({ percent }) => (percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : '')}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
          <Label
            position="center"
            content={({ viewBox }) => {
              const { cx, cy } = viewBox
              return (
                <text x={cx} y={cy} textAnchor="middle">
                  <tspan
                    x={cx}
                    dy="-0.2em"
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, fill: '#F8F8F8' }}
                  >
                    {total.toLocaleString()}
                  </tspan>
                  <tspan x={cx} dy="1.5em" style={{ fontSize: 11, fill: chartTheme.axis }}>
                    {centerLabel}
                  </tspan>
                </text>
              )
            }}
          />
        </Pie>
        <Tooltip
          {...tooltipProps}
          formatter={(value, name) => [
            `${value.toLocaleString()} shipments (${total ? ((value / total) * 100).toFixed(1) : 0}%)`,
            name,
          ]}
        />
        <Legend
          {...legendProps}
          verticalAlign="bottom"
          formatter={(value, entry) => `${value} · ${entry?.payload?.value?.toLocaleString?.() ?? ''}`}
        />
      </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
