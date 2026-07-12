import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { axisProps, chartTheme, legendProps, tooltipProps } from './chartTheme.js'

// Month-on-Month combo trend (UI_DESIGN_SPEC §3.2). Volume lines on the left
// axis, E+OT % on the right axis. data rows:
//   { month, total, early, on_time, late, eot_percent }
export default function TrendChart({ data = [], height = 320 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartTheme.grid} vertical={false} />
        <XAxis dataKey="month" {...axisProps} />
        <YAxis yAxisId="left" {...axisProps} allowDecimals={false} />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          unit="%"
          {...axisProps}
        />
        <Tooltip {...tooltipProps} />
        <Legend {...legendProps} />
        <Line yAxisId="left" type="monotone" dataKey="total" name="Total" stroke={chartTheme.status.onTime} strokeWidth={2} dot={{ r: 3 }} animationDuration={chartTheme.animationDuration} />
        <Line yAxisId="left" type="monotone" dataKey="early" name="Early" stroke={chartTheme.status.early} strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} animationDuration={chartTheme.animationDuration} />
        <Line yAxisId="left" type="monotone" dataKey="on_time" name="On Time" stroke={chartTheme.status.onTimeAlt} strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} animationDuration={chartTheme.animationDuration} />
        <Line yAxisId="left" type="monotone" dataKey="late" name="Late" stroke={chartTheme.status.late} strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} animationDuration={chartTheme.animationDuration} />
        <Line yAxisId="right" type="monotone" dataKey="eot_percent" name="E+OT %" stroke={chartTheme.status.primary} strokeWidth={3} dot={{ r: 3 }} animationDuration={chartTheme.animationDuration} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
