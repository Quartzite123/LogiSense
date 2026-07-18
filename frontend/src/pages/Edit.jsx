import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { fetchJSON } from '../lib/api.js'
import { useUI } from '../context/ui.jsx'

function MatrixTab() {
  const ui = useUI()
  const matrix = useQuery({ queryKey: ['edit', 'matrix'], queryFn: () => fetchJSON('/api/edit/matrix') })

  if (matrix.isLoading || !matrix.data) return <Skeleton height={280} style={{ borderRadius: 12 }} />
  const { zones, values } = matrix.data

  return (
    <div className="rounded-xl border border-[#27272A] bg-[#0F0F11] p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="max-w-2xl text-xs text-[#71717A]">
          Diagonal = intra-zone TAT (yellow-tinted). Values are days. Edits affect future uploads only — past
          shipments keep their already-stored Expected TAT.
        </p>
        <button
          onClick={() => ui?.toast('success', 'Matrix editing coming soon')}
          className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-black"
          style={{ background: '#FFD60A' }}
        >
          Edit matrix
        </button>
      </div>

      <div className="overflow-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-[#27272A] bg-[#15151A] px-4 py-2.5 text-left text-[11px] uppercase tracking-wide text-[#71717A]">
                Origin ↓ / Dest →
              </th>
              {zones.map((z) => (
                <th key={z} className="border border-[#27272A] bg-[#15151A] px-4 py-2.5 text-center text-[11px] uppercase tracking-wide text-[#71717A]">
                  {z}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zones.map((origin, i) => (
              <tr key={origin}>
                <td className="border border-[#27272A] bg-[#15151A] px-4 py-2.5 text-[11px] uppercase tracking-wide text-[#71717A]">{origin}</td>
                {zones.map((_, j) => {
                  const diag = i === j
                  return (
                    <td
                      key={j}
                      className="border border-[#27272A] px-4 py-2.5 text-center font-mono"
                      style={{
                        background: diag ? 'rgba(255,214,10,0.08)' : '#0F0F11',
                        color: diag ? '#FFD60A' : '#F8F8F8',
                        fontWeight: diag ? 700 : 400,
                      }}
                    >
                      {values[i][j] ?? '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const odaPill = (v) => {
  const ok = v === 'YES'
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        color: ok ? '#4ADE80' : '#94A3B8',
        background: ok ? 'rgba(74,222,128,0.15)' : 'rgba(148,163,184,0.15)',
      }}
    >
      {v}
    </span>
  )
}

const PINCODE_COLUMNS = [
  { key: 'pincode', label: 'Pincode' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zone', label: 'Zone' },
  { key: 'oda', label: 'ODA', render: odaPill },
]

function PincodeTab() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 50

  const q = useQuery({
    queryKey: ['edit', 'pincodes', page, search],
    queryFn: () => fetchJSON(`/api/edit/pincodes?page=${page}&per_page=${perPage}&search=${encodeURIComponent(search)}`),
    keepPreviousData: true,
  })

  const total = q.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Search pincode / city / state…"
          className="w-72 rounded-md border border-[#27272A] bg-[#15151A] px-3 py-2 text-sm text-[#F8F8F8] placeholder:text-[#71717A] focus:border-[#3F3F46] focus:outline-none"
        />
        <span className="text-sm text-[#71717A]">
          <span className="font-mono text-[#F8F8F8]">{total.toLocaleString()}</span> pincodes
        </span>
      </div>

      {q.isLoading && !q.data ? (
        <Skeleton height={320} style={{ borderRadius: 12 }} />
      ) : (
        <DataTable columns={PINCODE_COLUMNS} data={q.data?.rows || []} />
      )}

      <div className="flex items-center justify-center gap-4 text-sm">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded-md border border-[#27272A] px-3 py-1.5 text-[#F8F8F8] hover:border-[#3F3F46] disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="text-[#71717A]">
          Page <span className="font-mono text-[#F8F8F8]">{page}</span> of{' '}
          <span className="font-mono text-[#F8F8F8]">{totalPages.toLocaleString()}</span>
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="rounded-md border border-[#27272A] px-3 py-1.5 text-[#F8F8F8] hover:border-[#3F3F46] disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  )
}

export default function Edit() {
  const [tab, setTab] = useState('Region Matrix')
  const tabs = ['Region Matrix', 'Pincode Master']

  return (
    <div className="page-container mx-auto flex max-w-[1600px] flex-col gap-8 px-10 py-8">
      <PageHeader title="Edit" subtitle="Reference data · read-only" showUpload={false} />

      <div className="flex gap-6 border-b border-[#27272A]">
        {tabs.map((t) => {
          const active = t === tab
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="pb-3 text-sm font-medium transition-colors"
              style={{
                color: active ? '#F8F8F8' : '#71717A',
                borderBottom: active ? '2px solid #FFD60A' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t}
            </button>
          )
        })}
      </div>

      {tab === 'Region Matrix' ? <MatrixTab /> : <PincodeTab />}
    </div>
  )
}
