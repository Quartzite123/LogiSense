import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { axisProps, chartTheme, legendProps, tooltipProps, truncateLabel } from './chartTheme.js'

// Grouped bar chart (UI_DESIGN_SPEC §3.2 — ODA & company performance).
//   data: [{ [xKey]: 'ODA', Early: 12, 'On Time': 8, Late: 3 }, ...]
//   bars: [{ key, name?, color }]
//   showLabels: render the value on top of each bar
// angledLabels truncates + rotates long X labels (full name stays in tooltip).
export default function GroupedBar({
  data = [],
  bars = [],
  xKey = 'group',
  height = 280,
  yUnit = '',
  showLabels = false,
  barSize = 28,
  angledLabels = false,
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 24, right: 12, left: 0, bottom: angledLabels ? 16 : 0 }}
        barCategoryGap="40%"
        barGap={6}
      >
        <CartesianGrid stroke={chartTheme.grid} vertical={false} />
        <XAxis
          dataKey={xKey}
          {...axisProps}
          interval={0}
          tickFormatter={angledLabels ? truncateLabel : undefined}
          angle={angledLabels ? -40 : 0}
          textAnchor={angledLabels ? 'end' : 'middle'}
          height={angledLabels ? 120 : undefined}
        />
        <YAxis {...axisProps} unit={yUnit} allowDecimals={false} />
        <Tooltip {...tooltipProps} />
        <Legend {...legendProps} />
        {bars.map((b) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.name || b.key}
            fill={b.color}
            radius={[3, 3, 0, 0]}
            barSize={barSize}
            isAnimationActive
            animationDuration={chartTheme.animationDuration}
          >
            {showLabels && (
              <LabelList
                dataKey={b.key}
                position="top"
                style={{ fill: '#A1A1AA', fontSize: 11 }}
                formatter={(v) => (v ? `${v}${yUnit}` : '')}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
