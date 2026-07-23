import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusPill from '../components/StatusPill.jsx'
import ColumnPicker from '../components/ColumnPicker.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Skeleton from '../components/Skeleton.jsx'
import Donut from '../components/charts/Donut.jsx'
import ChartPair from '../components/charts/ChartPair.jsx'
import { fetchJSON, download } from '../lib/api.js'

function Chip({ label, value, color, className = '' }) {
  return (
    <div className={`rounded-xl border border-[#27272A] bg-[#0F0F11] ${className}`} style={{ padding: '18px 24px' }}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8A93]">{label}</div>
      <div className="mt-1 font-mono font-bold leading-none" style={{ color, fontSize: 32 }}>{value}</div>
    </div>
  )
}

const STATUS_COLORS = {
  'In Transit': '#60A5FA',
  Pending: '#FBBF24',
  Dispatched: '#93C5FD',
  Manifested: '#94A3B8',
  RTO: '#94A3B8',
}

const daysRemaining = (v) =>
  v == null ? '—' : <span className="font-mono" style={{ color: v < 0 ? '#F87171' : v > 0 ? '#4ADE80' : '#FBBF24' }}>{v}</span>

const COLUMN_DEFS = [
  { key: 'lrn', label: 'LRN' },
  { key: 'order_id', label: 'Company' },
  { key: 'current_status', label: 'Current Status', render: (v) => <StatusPill status={v} /> },
  { key: 'manifest_date', label: 'Manifest Date' },
  { key: 'expected_date', label: 'Expected Date' },
  { key: 'days_in_transit', label: 'Days in Transit' },
  { key: 'days_remaining', label: 'Days Remaining', render: daysRemaining },
  { key: 'risk_status', label: 'Risk Status', render: (v) => <StatusPill status={v} /> },
  { key: '_oda', label: 'ODA' },
  { key: 'last_scan_date', label: 'Last Scan Date' },
  { key: 'destination_city', label: 'Destination City' },
  { key: 'state', label: 'State' },
  { key: 'pin_code', label: 'Pin Code' },
]
const DEF_BY_KEY = Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, c]))
const ALL_COLS = COLUMN_DEFS.map(({ key, label }) => ({ key, label }))
const DEFAULT_KEYS = COLUMN_DEFS.map((c) => c.key)

const DIMENSIONS = ['Per-company', 'Per-state', 'By status']

export default function Transit() {
  const summary = useQuery({ queryKey: ['transit', 'summary'], queryFn: () => fetchJSON('/api/transit/summary') })
  const ordersQ = useQuery({ queryKey: ['transit', 'orders'], queryFn: () => fetchJSON('/api/transit/orders') })
  const aggCompanies = useQuery({ queryKey: ['aggregate', 'companies'], queryFn: () => fetchJSON('/api/aggregate/companies') })

  const [visible, setVisible] = useState(DEFAULT_KEYS)
  const [sortBy, setSortBy] = useState(null) // null → keep backend At-Risk-first order
  const [sortDir, setSortDir] = useState('asc')

  const s = summary.data
  const rows = ordersQ.data?.orders || []

  const donutData = useMemo(() => {
    const m = {}
    for (const r of rows) m[r.current_status] = (m[r.current_status] || 0) + 1
    return Object.entries(m).map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] || '#94A3B8' }))
  }, [rows])

  const seriesFor = (dim) => {
    // Per-company → Early/On Time/Late % grouped bar (like the Aggregate page).
    if (dim === 'Per-company') {
      const cos = aggCompanies.data || []
      return {
        xKey: 'name',
        yUnit: '%',
        data: cos.map((c) => ({
          name: c.company,
          Early: c.delivered ? Number(((c.early / c.delivered) * 100).toFixed(1)) : 0,
          'On Time': c.delivered ? Number(((c.on_time / c.delivered) * 100).toFixed(1)) : 0,
          Late: c.delivered ? Number(((c.late / c.delivered) * 100).toFixed(1)) : 0,
        })),
        bars: [
          { key: 'Early', color: '#4ADE80' },
          { key: 'On Time', color: '#60A5FA' },
          { key: 'Late', color: '#F87171' },
        ],
      }
    }
    // Per-state / By status → single-series count of in-flight orders.
    const key = dim === 'Per-state' ? 'state' : 'current_status'
    const m = {}
    for (const r of rows) {
      const k = r[key] || 'Unknown'
      m[k] = (m[k] || 0) + 1
    }
    return {
      xKey: 'name',
      data: Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 15),
      bars: [{ key: 'value', name: 'Orders', color: '#60A5FA' }],
    }
  }

  const columns = visible.map((k) => DEF_BY_KEY[k])
  const isEmpty = ordersQ.isSuccess && rows.length === 0

  return (
    <div className="page-container mx-auto flex max-w-[1600px] flex-col gap-8 px-10 py-8">
      <PageHeader title="Transit" subtitle="In-flight orders · Risk triage" />

      {isEmpty ? (
        <EmptyState message="No in-flight orders right now." />
      ) : (
        <>
          {/* Risk summary — four equal cards (4-up on desktop, 2-up on mobile) */}
          {summary.isLoading || !s ? (
            <Skeleton height={92} style={{ borderRadius: 12 }} />
          ) : (
            <div className="flex flex-wrap gap-4">
              <Chip className="grow basis-[calc(50%_-_0.5rem)] md:basis-[calc(25%_-_0.75rem)]" label="At Risk" value={s.at_risk.toLocaleString()} color="#F87171" />
              <Chip className="grow basis-[calc(50%_-_0.5rem)] md:basis-[calc(25%_-_0.75rem)]" label="Due Today" value={s.due_today.toLocaleString()} color="#FBBF24" />
              <Chip className="grow basis-[calc(50%_-_0.5rem)] md:basis-[calc(25%_-_0.75rem)]" label="On Track" value={s.on_track.toLocaleString()} color="#4ADE80" />
              <Chip className="grow basis-[calc(50%_-_0.5rem)] md:basis-[calc(25%_-_0.75rem)]" label="RTO" value={s.rto_count.toLocaleString()} color="#94A3B8" />
            </div>
          )}

          {/* In-flight donut + selectable chart-pair */}
          {ordersQ.isLoading ? (
            <Skeleton height={320} style={{ borderRadius: 12 }} />
          ) : (
            <ChartPair
              title="In-flight Status Distribution"
              topChart={<Donut centerLabel="in-flight" data={donutData} />}
              seriesFor={seriesFor}
              dimensionOptions={DIMENSIONS}
            />
          )}

          {/* Column picker + table */}
          <ColumnPicker
            allColumns={ALL_COLS}
            visibleColumns={visible}
            onChange={setVisible}
            defaultColumns={DEFAULT_KEYS}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortBy={setSortBy}
            onSortDir={setSortDir}
          />

          {ordersQ.isLoading || !ordersQ.data ? (
            <Skeleton height={320} style={{ borderRadius: 12 }} />
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              sort={sortBy ? { key: sortBy, direction: sortDir } : null}
              onSortChange={(next) => {
                setSortBy(next?.key ?? null)
                setSortDir(next?.direction ?? 'asc')
              }}
              onExport={() => download('/api/export/transit')}
              exportLabel="Export Transit Excel"
            />
          )}
        </>
      )}
    </div>
  )
}
