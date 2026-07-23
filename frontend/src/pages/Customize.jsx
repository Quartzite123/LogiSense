import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusPill from '../components/StatusPill.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Skeleton from '../components/Skeleton.jsx'
import FilterPanel from '../components/filters/FilterPanel.jsx'
import FilterSelect from '../components/filters/FilterSelect.jsx'
import SegmentedToggle from '../components/filters/SegmentedToggle.jsx'
import { fetchJSON, download } from '../lib/api.js'

const STATUSES = ['Manifested', 'Dispatched', 'In Transit', 'Pending', 'Delivered', 'RTO']
const SLA = ['Early', 'On Time', 'Late']
const ZONES = ['West', 'South', 'North', 'East', 'North-East']

const DETAIL_COLUMNS = [
  { key: 'lrn', label: 'LRN' },
  { key: 'order_id', label: 'Company' },
  { key: 'current_status', label: 'Current Status', render: (v) => <StatusPill status={v} /> },
  { key: 'manifest_date', label: 'Manifest Date' },
  { key: 'delivered_date', label: 'Delivered Date' },
  { key: 'destination_city', label: 'Destination City' },
  { key: 'state', label: 'State' },
  { key: 'pin_code', label: 'Pin Code' },
  { key: '_oda', label: 'ODA' },
  { key: '_sla_status', label: 'Delivery Status', render: (v) => <StatusPill status={v} /> },
]

const AGG_COLUMNS = [
  { key: 'company', label: 'Company' },
  { key: 'total', label: 'Total Orders' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'pending', label: 'Pending' },
  { key: 'rto', label: 'RTO' },
  { key: 'eot_percent', label: 'E+OT %', render: (v) => <span className="font-mono" style={{ color: '#B18AFF' }}>{v}%</span> },
  { key: 'oda_percent', label: 'ODA %', render: (v) => <span className="font-mono">{v}%</span> },
]

export default function Customize() {
  const [view, setView] = useState('Detail')
  const [companies, setCompanies] = useState([])
  const [statuses, setStatuses] = useState([])
  const [sla, setSla] = useState([])
  const [oda, setOda] = useState('Both')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [originZones, setOriginZones] = useState([])
  const [destZones, setDestZones] = useState([])

  const companyList = useQuery({ queryKey: ['aggregate', 'companies'], queryFn: () => fetchJSON('/api/aggregate/companies') })
  const kpis = useQuery({ queryKey: ['landing', 'kpis'], queryFn: () => fetchJSON('/api/landing/kpis') })
  const companyOptions = useMemo(() => (companyList.data || []).map((c) => c.company), [companyList.data])

  // Backend-supported filters (origin zone is applied client-side below).
  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (companies.length) p.set('company', companies.join(','))
    if (statuses.length) p.set('status', statuses.join(','))
    if (sla.length) p.set('sla_status', sla.join(','))
    if (oda !== 'Both') p.set('oda', oda === 'ODA' ? 'YES' : 'NO')
    if (dateFrom) p.set('date_from', dateFrom)
    if (dateTo) p.set('date_to', dateTo)
    if (destZones.length) p.set('zone', destZones.join(','))
    return p.toString()
  }, [companies, statuses, sla, oda, dateFrom, dateTo, destZones])

  const rowsQ = useQuery({
    queryKey: ['customize', qs],
    queryFn: () => fetchJSON(`/api/customize/orders${qs ? `?${qs}` : ''}`),
  })

  // Origin Zone filter is client-side (no backend param; origin is ~constant).
  const rows = useMemo(() => {
    const all = rowsQ.data || []
    return originZones.length ? all.filter((r) => originZones.includes(r._origin_zone)) : all
  }, [rowsQ.data, originZones])

  const aggRows = useMemo(() => {
    const m = {}
    for (const r of rows) {
      const co = r.order_id || 'Unknown'
      const a = (m[co] ||= { company: co, total: 0, delivered: 0, in_transit: 0, pending: 0, rto: 0, e: 0, ot: 0, odaYes: 0 })
      a.total++
      const st = r.current_status
      if (st === 'Delivered') a.delivered++
      else if (st === 'In Transit' || st === 'Dispatched' || st === 'Manifested') a.in_transit++
      else if (st === 'Pending') a.pending++
      else if (st === 'RTO') a.rto++
      if (r._sla_status === 'Early') a.e++
      else if (r._sla_status === 'On Time') a.ot++
      if (r._oda === 'YES') a.odaYes++
    }
    return Object.values(m)
      .map((a) => ({
        company: a.company,
        total: a.total,
        delivered: a.delivered,
        in_transit: a.in_transit,
        pending: a.pending,
        rto: a.rto,
        eot_percent: a.delivered ? Number((((a.e + a.ot) / a.delivered) * 100).toFixed(1)) : 0,
        oda_percent: a.total ? Number(((a.odaYes / a.total) * 100).toFixed(1)) : 0,
      }))
      .sort((x, y) => y.total - x.total)
  }, [rows])

  const resetFilters = () => {
    setCompanies([]); setStatuses([]); setSla([]); setOda('Both')
    setDateFrom(''); setDateTo(''); setOriginZones([]); setDestZones([])
  }

  const total = kpis.data?.total ?? 1000
  const shown = rows.length
  const dbEmpty = kpis.isSuccess && kpis.data?.total === 0

  return (
    <div className="page-container mx-auto flex max-w-[1600px] flex-col gap-8 px-10 py-8">
      <PageHeader title="Customize" subtitle="Ad-hoc query · Filter and export" />

      {dbEmpty ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#8A8A93]">View</span>
            <SegmentedToggle options={['Detail', 'Aggregate']} value={view} onChange={setView} />
          </div>

          <FilterPanel
            right={
              <button onClick={resetFilters} className="rounded-md border border-[#27272A] px-3 py-1.5 text-xs text-[#8A8A93] hover:border-[#3F3F46] hover:text-[#F8F8F8]">
                Reset Filters
              </button>
            }
          >
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-3">
              <FilterSelect label="Company" options={companyOptions} value={companies} onChange={setCompanies} />
              <FilterSelect label="Current Status" options={STATUSES} value={statuses} onChange={setStatuses} />
              <FilterSelect label="Delivery Status" options={SLA} value={sla} onChange={setSla} />
              <FilterSelect label="Origin Zone" options={ZONES} value={originZones} onChange={setOriginZones} />
              <FilterSelect label="Destination Zone" options={ZONES} value={destZones} onChange={setDestZones} />
              <div>
                <div className="mb-1 text-xs text-[#A1A1AA]">ODA</div>
                <SegmentedToggle options={['Both', 'ODA', 'Non-ODA']} value={oda} onChange={setOda} />
              </div>
              <div>
                <div className="mb-1 text-xs text-[#A1A1AA]">Manifest From</div>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border border-[#27272A] bg-[#15151A] px-2 py-1.5 text-sm text-[#F8F8F8]" />
              </div>
              <div>
                <div className="mb-1 text-xs text-[#A1A1AA]">Manifest To</div>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border border-[#27272A] bg-[#15151A] px-2 py-1.5 text-sm text-[#F8F8F8]" />
              </div>
            </div>
          </FilterPanel>

          <div className="text-sm text-[#8A8A93]">
            Showing <span className="font-mono text-[#F8F8F8]">{shown.toLocaleString()}</span> of{' '}
            <span className="font-mono text-[#F8F8F8]">{total.toLocaleString()}</span> shipments
          </div>

          {rowsQ.isLoading || !rowsQ.data ? (
            <Skeleton height={320} style={{ borderRadius: 12 }} />
          ) : view === 'Detail' ? (
            <DataTable
              columns={DETAIL_COLUMNS}
              data={rows}
              defaultSort={{ key: 'manifest_date', direction: 'desc' }}
              onExport={() => download(`/api/export/customize${qs ? `?${qs}` : ''}`)}
              exportLabel="Export Filtered Excel"
            />
          ) : (
            <DataTable
              columns={AGG_COLUMNS}
              data={aggRows}
              defaultSort={{ key: 'total', direction: 'desc' }}
              onExport={() => download(`/api/export/customize${qs ? `?${qs}` : ''}`)}
              exportLabel="Export Filtered Excel"
            />
          )}
        </>
      )}
    </div>
  )
}
