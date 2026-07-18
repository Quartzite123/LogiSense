import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusPill from '../components/StatusPill.jsx'
import ColumnPicker from '../components/ColumnPicker.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Skeleton from '../components/Skeleton.jsx'
import GroupedBar from '../components/charts/GroupedBar.jsx'
import { fetchJSON, download } from '../lib/api.js'

function Chip({ label, value, sub, color }) {
  return (
    <div className="flex-1 rounded-xl border border-[#27272A] bg-[#0F0F11] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#71717A]">{label}</div>
      <div className="mt-1 font-mono text-2xl font-bold" style={{ color }}>{value}</div>
      {sub != null && <div className="mt-0.5 text-xs text-[#71717A]">{sub}</div>}
    </div>
  )
}

const variance = (v) => (
  <span className="font-mono" style={{ color: v == null ? '#71717A' : v < 0 ? '#4ADE80' : v > 0 ? '#F87171' : '#60A5FA' }}>
    {v == null ? '—' : v}
  </span>
)

const COLUMN_DEFS = [
  { key: 'lrn', label: 'LRN' },
  { key: 'order_id', label: 'Company' },
  { key: 'consignee_name', label: 'Consignee' },
  { key: 'manifest_date', label: 'Manifest Date' },
  { key: 'delivered_date', label: 'Delivered Date' },
  { key: 'destination_city', label: 'Destination City' },
  { key: 'state', label: 'State' },
  { key: 'pin_code', label: 'Pin Code' },
  { key: '_origin_zone', label: 'Origin Zone' },
  { key: '_destination_zone', label: 'Destination Zone' },
  { key: '_oda', label: 'ODA' },
  { key: '_expected_tat_days', label: 'Expected TAT' },
  { key: '_actual_tat_days', label: 'Actual TAT' },
  { key: '_tat_variance_days', label: 'TAT Variance', render: variance },
  { key: '_sla_status', label: 'Delivery Status', render: (v) => <StatusPill status={v} /> },
]
const DEF_BY_KEY = Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, c]))
const ALL_COLS = COLUMN_DEFS.map(({ key, label }) => ({ key, label }))
const DEFAULT_KEYS = [
  'lrn', 'order_id', 'manifest_date', 'delivered_date', 'destination_city',
  'state', '_oda', '_expected_tat_days', '_actual_tat_days', '_tat_variance_days', '_sla_status',
]

const ODA_DETAIL_COLUMNS = [
  { key: 'company', label: 'Company' },
  { key: 'oda_eot', label: 'ODA E+OT %', render: (v) => (v == null ? '—' : <span className="font-mono" style={{ color: '#FFD60A' }}>{v}%</span>) },
  { key: 'non_eot', label: 'Non-ODA E+OT %', render: (v) => (v == null ? '—' : <span className="font-mono" style={{ color: '#FFD60A' }}>{v}%</span>) },
]

export default function TAT() {
  const summary = useQuery({ queryKey: ['tat', 'summary'], queryFn: () => fetchJSON('/api/tat/summary') })
  const oda = useQuery({ queryKey: ['tat', 'oda'], queryFn: () => fetchJSON('/api/tat/oda-chart') })
  const orders = useQuery({ queryKey: ['tat', 'orders'], queryFn: () => fetchJSON('/api/tat/orders') })

  const [visible, setVisible] = useState(DEFAULT_KEYS)
  const [sortBy, setSortBy] = useState('manifest_date')
  const [sortDir, setSortDir] = useState('desc')

  const s = summary.data
  const pctOf = (n) => (s && s.total_delivered > 0 ? `${((n / s.total_delivered) * 100).toFixed(1)}%` : '—')

  const odaPct = (g) => {
    const t = g.total || 0
    return {
      Early: t ? Number(((g.early / t) * 100).toFixed(1)) : 0,
      'On Time': t ? Number(((g.on_time / t) * 100).toFixed(1)) : 0,
      Late: t ? Number(((g.late / t) * 100).toFixed(1)) : 0,
    }
  }
  const odaGroups = []
  if (oda.data?.oda) odaGroups.push({ group: 'ODA', ...odaPct(oda.data.oda) })
  if (oda.data?.non_oda) odaGroups.push({ group: 'Non-ODA', ...odaPct(oda.data.non_oda) })
  const onlyNonOda = oda.data && !oda.data.oda && oda.data.non_oda

  // Per-company ODA / Non-ODA E+OT% computed from the delivered orders.
  const odaDetail = useMemo(() => {
    const m = {}
    for (const o of orders.data || []) {
      const co = o.order_id || 'Unknown'
      const e = (m[co] ||= { odaEO: 0, odaT: 0, nonEO: 0, nonT: 0 })
      const eot = o._sla_status === 'Early' || o._sla_status === 'On Time'
      if (o._oda === 'YES') { e.odaT++; if (eot) e.odaEO++ }
      else if (o._oda === 'NO') { e.nonT++; if (eot) e.nonEO++ }
    }
    return Object.entries(m)
      .map(([company, v]) => ({
        company,
        oda_eot: v.odaT ? Number(((v.odaEO / v.odaT) * 100).toFixed(1)) : null,
        non_eot: v.nonT ? Number(((v.nonEO / v.nonT) * 100).toFixed(1)) : null,
      }))
      .sort((a, b) => (b.non_eot ?? -1) - (a.non_eot ?? -1))
  }, [orders.data])

  const columns = visible.map((k) => DEF_BY_KEY[k])
  const isEmpty = orders.isSuccess && orders.data.length === 0

  return (
    <div className="page-container mx-auto flex max-w-[1600px] flex-col gap-8 px-10 py-8">
      <PageHeader title="TAT Analysis" subtitle="Delivered orders · E+OT performance" />

      {isEmpty ? (
        <EmptyState message="No delivered orders yet — upload a Delhivery export." />
      ) : (
        <>
          {/* Summary chips */}
          <div className="flex flex-wrap gap-4">
            {summary.isLoading || !s ? (
              <Skeleton height={88} />
            ) : (
              <>
                <Chip label="Total Delivered" value={s.total_delivered.toLocaleString()} sub={`${s.eot_percent.toFixed(1)}% E+OT`} color="#F8F8F8" />
                <Chip label="Early" value={s.early.toLocaleString()} sub={pctOf(s.early)} color="#4ADE80" />
                <Chip label="On Time" value={s.on_time.toLocaleString()} sub={pctOf(s.on_time)} color="#60A5FA" />
                <Chip label="Late" value={s.late.toLocaleString()} sub={pctOf(s.late)} color="#F87171" />
              </>
            )}
          </div>

          {/* ODA grouped bar + detail table */}
          {odaGroups.length > 0 && (
            <div className="rounded-xl border border-[#27272A] bg-[#0F0F11] p-5">
              <h2 className="mb-1 text-sm font-semibold text-[#F8F8F8]">ODA vs Non-ODA — Delivery Performance</h2>
              {onlyNonOda && <p className="mb-3 text-xs text-[#71717A]">No ODA-classified deliveries in current dataset</p>}
              <GroupedBar
                data={odaGroups}
                xKey="group"
                yUnit="%"
                showLabels
                bars={[
                  { key: 'Early', color: '#4ADE80' },
                  { key: 'On Time', color: '#60A5FA' },
                  { key: 'Late', color: '#F87171' },
                ]}
              />
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#71717A]">Detail breakdown — by company</div>
                <DataTable columns={ODA_DETAIL_COLUMNS} data={odaDetail} defaultSort={{ key: 'non_eot', direction: 'desc' }} />
              </div>
            </div>
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

          {orders.isLoading || !orders.data ? (
            <Skeleton height={320} style={{ borderRadius: 12 }} />
          ) : (
            <DataTable
              columns={columns}
              data={orders.data}
              sort={sortBy ? { key: sortBy, direction: sortDir } : null}
              onSortChange={(next) => {
                setSortBy(next?.key ?? null)
                setSortDir(next?.direction ?? 'asc')
              }}
              onExport={() => download('/api/export/tat')}
              exportLabel="Export TAT Excel"
            />
          )}
        </>
      )}
    </div>
  )
}
