import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { fetchJSON } from '../lib/api.js'

const RISK_META = {
  'At Risk': { color: '#F87171', bg: 'rgba(248,113,113,0.2)' },
  'Due Today': { color: '#FBBF24', bg: 'rgba(251,191,36,0.2)' },
  'On Track': { color: '#4ADE80', bg: 'rgba(74,222,128,0.2)' },
  Pending: { color: '#94A3B8', bg: 'rgba(148,163,184,0.2)' },
}

const ORDER_COLUMNS = [
  { key: 'lrn', label: 'LRN' },
  { key: 'order_id', label: 'Order ID' },
  { key: 'no_of_boxes', label: 'No of Boxes' },
  { key: 'client', label: 'Client' },
  { key: 'manifest_date', label: 'Manifest Date' },
  { key: 'pickup_date', label: 'Pickup Date' },
  { key: 'expected_date', label: 'Expected Date' },
  { key: 'invoice_number', label: 'Invoice Number' },
  { key: 'consignee_name', label: 'Consignee Name' },
]

function Panel({ title, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-[#27272A] bg-[#0F0F11] p-5 ${className}`}>
      {title && <h2 className="mb-4 text-sm font-semibold text-[#F8F8F8]">{title}</h2>}
      {children}
    </div>
  )
}

function RiskSummaryTable({ rows }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wide text-[#8A8A93]">
          <th className="px-3 py-2">Risk Status</th>
          <th className="px-3 py-2 text-right">Orders</th>
          <th className="px-3 py-2 text-right">% of Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const meta = RISK_META[r.status] || { color: '#27272A', bg: 'transparent' }
          return (
            <tr key={r.status} style={{ background: meta.bg }}>
              <td className="px-3 py-2.5 font-medium text-[#F8F8F8]" style={{ borderLeft: `4px solid ${meta.color}` }}>
                {r.status}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-[#F8F8F8]">{r.count}</td>
              <td className="px-3 py-2.5 text-right font-mono text-[#F8F8F8]">{r.percent.toFixed(1)}%</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function DaysOverdueTable({ rows }) {
  if (!rows.length) {
    return (
      <div className="flex h-full min-h-[140px] items-center justify-center rounded-lg border border-dashed border-[#27272A] text-sm text-[#8A8A93]">
        No overdue orders
      </div>
    )
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wide text-[#8A8A93]">
          <th className="px-3 py-2">Days Overdue</th>
          <th className="px-3 py-2 text-right">Orders</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.days_overdue} className="border-b border-[#1F1F23]">
            <td className="px-3 py-2 font-mono font-semibold text-[#F87171]">{r.days_overdue}</td>
            <td className="px-3 py-2 text-right font-mono text-[#F8F8F8]">{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ErrorBox({ query }) {
  return (
    <div className="rounded-lg border border-[#F87171]/50 bg-[#F87171]/10 p-5 text-sm">
      <div className="font-medium text-[#F87171]">Couldn’t load data.</div>
      <div className="mt-1 text-[#8A8A93]">{String(query.error?.message)} — is the backend running on :8000?</div>
      <button onClick={() => query.refetch()} className="mt-3 rounded-md border border-[#27272A] bg-[#15151A] px-3 py-1.5 text-[#F8F8F8] hover:border-[#B18AFF]">
        Retry
      </button>
    </div>
  )
}

export default function AggregateTransit() {
  const companies = useQuery({
    queryKey: ['aggregate-transit', 'companies'],
    queryFn: () => fetchJSON('/api/aggregate-transit/companies'),
  })
  const [company, setCompany] = useState(null)

  // Dropdown is sorted by in-flight (undelivered) count descending.
  const sortedCompanies = useMemo(
    () => [...(companies.data || [])].sort((a, b) => b.total_in_flight - a.total_in_flight),
    [companies.data],
  )

  useEffect(() => {
    if (!company && sortedCompanies.length) setCompany(sortedCompanies[0].company)
  }, [sortedCompanies, company])

  const detail = useQuery({
    queryKey: ['aggregate-transit', 'detail', company],
    queryFn: () => fetchJSON(`/api/aggregate-transit/company-detail?company=${encodeURIComponent(company)}`),
    enabled: !!company,
  })

  const isEmpty = companies.isSuccess && companies.data.length === 0

  return (
    <div className="page-container mx-auto flex max-w-[1600px] flex-col gap-8 px-10 py-8">
      <PageHeader title="Aggregate Transit" subtitle="Company-wise in-flight orders" />

      {companies.isError ? (
        <ErrorBox query={companies} />
      ) : isEmpty ? (
        <EmptyState message="No in-flight orders right now." />
      ) : companies.isLoading ? (
        <Skeleton height={64} style={{ borderRadius: 12 }} />
      ) : (
        <>
          {/* Section 1 — company selector */}
          <div>
            <label className="mb-1 block text-sm text-[#A1A1AA]">
              Company (sorted by undelivered count, descending)
            </label>
            <select
              value={company || ''}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-lg border border-[#27272A] bg-[#15151A] px-3 py-2.5 text-sm text-[#F8F8F8]"
            >
              {sortedCompanies.map((c) => (
                <option key={c.company} value={c.company}>
                  {c.company} ({c.total_in_flight})
                </option>
              ))}
            </select>
          </div>

          {detail.isError ? (
            <ErrorBox query={detail} />
          ) : detail.isLoading || !detail.data ? (
            <Skeleton height={240} style={{ borderRadius: 12 }} />
          ) : (
            <>
              {/* Section 2 — two tables side by side */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel title="Risk Status Summary">
                  <RiskSummaryTable rows={detail.data.risk_summary} />
                </Panel>
                <Panel title="Days Overdue breakdown">
                  <DaysOverdueTable rows={detail.data.days_overdue_breakdown} />
                </Panel>
              </div>

              {/* Section 3 — individual orders */}
              <Panel title={`Individual orders — ${company}`}>
                <DataTable
                  columns={ORDER_COLUMNS}
                  data={detail.data.orders}
                  defaultSort={{ key: 'lrn', direction: 'asc' }}
                />
              </Panel>
            </>
          )}
        </>
      )}
    </div>
  )
}
