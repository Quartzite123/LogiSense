import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Skeleton from '../components/Skeleton.jsx'
import GroupedBar from '../components/charts/GroupedBar.jsx'
import StackedBar from '../components/charts/StackedBar.jsx'
import { fetchJSON, download } from '../lib/api.js'

function eotColor(v) {
  if (v >= 85) return '#4ADE80'
  if (v >= 70) return '#FFD60A'
  return '#F87171'
}

const COLUMNS = [
  { key: 'company', label: 'Company' },
  { key: 'total', label: 'Total' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'pending', label: 'Pending' },
  { key: 'rto', label: 'RTO' },
  { key: 'eot_percent', label: 'E+OT %', render: (v) => <span className="font-mono font-semibold" style={{ color: eotColor(v) }}>{v.toFixed(1)}%</span> },
  { key: 'oda_count', label: 'ODA' },
  { key: 'avg_actual_tat', label: 'Avg Actual TAT' },
]

function Panel({ title, children, right }) {
  return (
    <div className="rounded-xl border border-[#27272A] bg-[#0F0F11] p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-[#F8F8F8]">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}

export default function Aggregate() {
  const companies = useQuery({ queryKey: ['aggregate', 'companies'], queryFn: () => fetchJSON('/api/aggregate/companies') })
  const [company, setCompany] = useState(null)

  useEffect(() => {
    if (!company && companies.data?.length) setCompany(companies.data[0].company)
  }, [companies.data, company])

  const monthly = useQuery({
    queryKey: ['aggregate', 'monthly', company],
    queryFn: () => fetchJSON(`/api/aggregate/monthly?company=${encodeURIComponent(company)}`),
    enabled: !!company,
  })

  const perfData = (companies.data || []).map((c) => ({
    group: c.company,
    Early: c.delivered ? Number(((c.early / c.delivered) * 100).toFixed(1)) : 0,
    'On Time': c.delivered ? Number(((c.on_time / c.delivered) * 100).toFixed(1)) : 0,
    Late: c.delivered ? Number(((c.late / c.delivered) * 100).toFixed(1)) : 0,
  }))

  const isEmpty = companies.isSuccess && companies.data.length === 0

  return (
    <div className="page-container mx-auto flex max-w-[1600px] flex-col gap-8 px-10 py-8">
      <PageHeader title="Aggregate" subtitle="Company-level performance" />

      {isEmpty ? (
        <EmptyState />
      ) : companies.isLoading || !companies.data ? (
        <Skeleton height={320} style={{ borderRadius: 12 }} />
      ) : (
        <>
          <DataTable
            columns={COLUMNS}
            data={companies.data}
            defaultSort={{ key: 'total', direction: 'desc' }}
            onExport={() => download('/api/export/aggregate')}
            exportLabel="Export Aggregate Excel"
          />

          <Panel title="Delivery Performance by Company">
            <GroupedBar
              data={perfData}
              xKey="group"
              yUnit="%"
              height={360}
              barSize={14}
              angledLabels
              bars={[
                { key: 'Early', color: '#4ADE80' },
                { key: 'On Time', color: '#60A5FA' },
                { key: 'Late', color: '#F87171' },
              ]}
            />
          </Panel>

          <Panel
            title={`Monthly Breakdown — ${company || ''}`}
            right={
              <select
                value={company || ''}
                onChange={(e) => setCompany(e.target.value)}
                className="rounded-md border border-[#27272A] bg-[#15151A] px-2 py-1.5 text-sm text-[#F8F8F8]"
              >
                {companies.data.map((c) => (
                  <option key={c.company} value={c.company}>
                    {c.company}
                  </option>
                ))}
              </select>
            }
          >
            {monthly.isLoading || !monthly.data ? (
              <Skeleton height={300} />
            ) : monthly.data.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-[#71717A]">No monthly data</div>
            ) : (
              <StackedBar
                data={monthly.data}
                xKey="month"
                bars={[
                  { key: 'early', name: 'Early', color: '#4ADE80' },
                  { key: 'on_time', name: 'On Time', color: '#60A5FA' },
                  { key: 'late', name: 'Late', color: '#F87171' },
                  { key: 'not_delivered', name: 'Not Delivered', color: '#94A3B8' },
                ]}
              />
            )}
          </Panel>
        </>
      )}
    </div>
  )
}
