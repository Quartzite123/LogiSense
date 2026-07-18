import { useQuery } from '@tanstack/react-query'
import PageHeader from '../components/PageHeader.jsx'
import KPICard from '../components/KPICard.jsx'
import DataTable from '../components/DataTable.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Skeleton from '../components/Skeleton.jsx'
import Donut from '../components/charts/Donut.jsx'
import TrendChart from '../components/charts/TrendChart.jsx'
import { fetchJSON } from '../lib/api.js'

const useLanding = (slug) =>
  useQuery({ queryKey: ['landing', slug], queryFn: () => fetchJSON(`/api/landing/${slug}`) })

const pct = (n, d) => (d > 0 ? (n / d) * 100 : 0)

function Panel({ title, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-[#27272A] bg-[#0F0F11] p-5 ${className}`}>
      {title && <h2 className="mb-4 text-sm font-semibold text-[#F8F8F8]">{title}</h2>}
      {children}
    </div>
  )
}

// 12-card KPI grid (4 rows: 3 / 3 / 4 / 2).
function KpiGrid({ d }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="TOTAL ORDERS" value={d.total} valueColor="#F8F8F8" subtext="All shipments in pipeline" />
        <KPICard label="DELIVERED" value={d.delivered} valueColor="#4ADE80" subtext={`${pct(d.delivered, d.total).toFixed(1)}% of total`} showBar barPercent={pct(d.delivered, d.total)} />
        <KPICard label="IN TRANSIT" value={d.in_transit} valueColor="#60A5FA" subtext={`${pct(d.in_transit, d.total).toFixed(1)}% of total`} showBar barPercent={pct(d.in_transit, d.total)} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="PENDING" value={d.pending} valueColor="#FFD60A" subtext={`${pct(d.pending, d.total).toFixed(1)}% of total`} showBar barPercent={pct(d.pending, d.total)} />
        <KPICard label="RTO" value={d.rto} valueColor="#F87171" subtext={`${pct(d.rto, d.total).toFixed(1)}% of total`} showBar barPercent={pct(d.rto, d.total)} />
        <KPICard label="DATE RANGE" value={`${d.date_min} → ${d.date_max}`} isDateCard subtext="based on Manifest Date" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        <KPICard label="EARLY" value={d.early} valueColor="#4ADE80" subtext={`${pct(d.early, d.delivered).toFixed(1)}% of delivered`} showBar barPercent={pct(d.early, d.delivered)} />
        <KPICard label="ON TIME" value={d.on_time} valueColor="#60A5FA" subtext={`${pct(d.on_time, d.delivered).toFixed(1)}% of delivered`} showBar barPercent={pct(d.on_time, d.delivered)} />
        <KPICard label="E+OT" value={d.eot_count} valueColor="#FFD60A" subtext={`${d.eot_percent.toFixed(1)}% E+OT`} />
        <KPICard label="LATE" value={d.late} valueColor="#F87171" subtext={`${pct(d.late, d.delivered).toFixed(1)}% of delivered`} showBar barPercent={pct(d.late, d.delivered)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <KPICard label="ODA · OUT OF DELIVERY AREA" value={d.oda_count} valueColor="#FFD60A" subtext={`${pct(d.oda_count, d.total).toFixed(1)}% of total`} />
        <KPICard label="NON-ODA" value={d.non_oda_count} valueColor="#F8F8F8" subtext={`${pct(d.non_oda_count, d.total).toFixed(1)}% of total`} />
      </div>
    </>
  )
}

function KpiSection({ query }) {
  if (query.isError)
    return (
      <div className="rounded-lg border border-[#F87171]/50 bg-[#F87171]/10 p-5 text-sm">
        <div className="font-medium text-[#F87171]">Couldn’t load KPIs.</div>
        <div className="mt-1 text-[#71717A]">{String(query.error?.message)} — is the backend running on :8000?</div>
        <button onClick={() => query.refetch()} className="mt-3 rounded-md border border-[#27272A] bg-[#15151A] px-3 py-1.5 text-[#F8F8F8] hover:border-[#FFD60A]">
          Retry
        </button>
      </div>
    )
  if (query.isLoading || !query.data)
    return (
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={112} style={{ borderRadius: 12 }} />
        ))}
      </div>
    )
  return <div className="flex flex-col gap-4"><KpiGrid d={query.data} /></div>
}

const TREND_COLUMNS = [
  { key: 'month', label: 'Month' },
  { key: 'total_orders', label: 'Total' },
  { key: 'early', label: 'Early', render: (v) => <span className="font-mono" style={{ color: '#4ADE80' }}>{v}</span> },
  { key: 'on_time', label: 'On Time', render: (v) => <span className="font-mono" style={{ color: '#60A5FA' }}>{v}</span> },
  { key: 'late', label: 'Late', render: (v) => <span className="font-mono" style={{ color: '#F87171' }}>{v}</span> },
  { key: 'eot_percent', label: 'E+OT %', render: (v) => <span className="font-mono" style={{ color: '#FFD60A' }}>{v}%</span> },
]

export default function Landing() {
  const kpis = useLanding('kpis')
  const donut = useLanding('donut')
  const trend = useLanding('trend')

  const trendRows = (trend.data?.months || []).map((month, i) => {
    const total_orders = trend.data.total_orders[i]
    const early = trend.data.early[i]
    const on_time = trend.data.on_time[i]
    const late = trend.data.late[i]
    const delivered = early + on_time + late
    const eot_percent = delivered > 0 ? Number((((early + on_time) / delivered) * 100).toFixed(1)) : 0
    return { month, total_orders, early, on_time, late, eot_percent }
  })

  const isEmpty = kpis.isSuccess && kpis.data?.total === 0

  return (
    <div className="page-container mx-auto flex max-w-[1600px] flex-col gap-8 px-10 py-8">
      <PageHeader title="Landing" subtitle="Overview of all shipments" />

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <KpiSection query={kpis} />

          <div className="trend-chart-container flex flex-col gap-6 lg:max-h-[480px] lg:flex-row">
            <Panel title="Overall Delivery Performance" className="lg:basis-[35%]">
              {donut.isLoading || !donut.data ? (
                <Skeleton height={300} />
              ) : (
                <Donut
                  centerLabel="shipments"
                  data={donut.data.labels.map((name, i) => ({ name, value: donut.data.values[i], color: donut.data.colors[i] }))}
                />
              )}
            </Panel>
            <Panel title="Month-on-Month Order Volume & Delivery Trend" className="grow lg:basis-[65%]">
              {trend.isLoading || !trend.data ? <Skeleton height={300} /> : <TrendChart data={trendRows} />}
            </Panel>
          </div>

          {trendRows.length > 0 && (
            <Panel title="Monthly Summary" className="monthly-summary-table">
              <DataTable columns={TREND_COLUMNS} data={trendRows} />
            </Panel>
          )}
        </>
      )}
    </div>
  )
}
