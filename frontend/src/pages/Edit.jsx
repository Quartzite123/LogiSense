import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { fetchJSON, sendJSON } from '../lib/api.js'
import { useUI } from '../context/ui.jsx'

function MatrixTab() {
  const ui = useUI()
  const qc = useQueryClient()
  const matrix = useQuery({ queryKey: ['edit', 'matrix'], queryFn: () => fetchJSON('/api/edit/matrix') })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  if (matrix.isLoading || !matrix.data) return <Skeleton height={280} style={{ borderRadius: 12 }} />
  const { zones, values } = matrix.data

  const startEdit = () => {
    setDraft(values.map((row) => row.map((v) => v ?? 1)))
    setEditing(true)
  }
  const cancel = () => {
    setEditing(false)
    setDraft(null)
  }
  const setCell = (i, j, val) =>
    setDraft((d) => d.map((row, ri) => (ri === i ? row.map((c, ci) => (ci === j ? val : c)) : row)))

  async function save() {
    const nums = draft.map((row) => row.map((v) => Number(v)))
    const invalid = nums.some((row) => row.some((v) => !Number.isInteger(v) || v < 1 || v > 30))
    if (invalid) {
      ui?.toast('error', 'All values must be whole numbers between 1 and 30.')
      return
    }
    setSaving(true)
    try {
      await sendJSON('/api/edit/matrix', 'PUT', { zones, values: nums })
      ui?.toast('success', 'Matrix saved — affects future uploads only')
      setEditing(false)
      setDraft(null)
      qc.invalidateQueries({ queryKey: ['edit', 'matrix'] })
    } catch (e) {
      ui?.toast('error', e.message || 'Failed to save matrix')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#27272A] bg-[#0F0F11] p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="max-w-2xl text-xs text-[#71717A]">
          Diagonal = intra-zone TAT (yellow-tinted). Values are days (1–30). Edits affect future uploads
          only — past shipments keep their already-stored Expected TAT.
        </p>
        {editing ? (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              style={{ background: '#FFD60A' }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="rounded-lg border border-[#27272A] bg-[#15151A] px-4 py-2 text-sm text-[#F8F8F8] hover:border-[#3F3F46] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-black"
            style={{ background: '#FFD60A' }}
          >
            Edit matrix
          </button>
        )}
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
                      className="border border-[#27272A] px-3 py-2 text-center font-mono"
                      style={{
                        background: diag ? 'rgba(255,214,10,0.08)' : '#0F0F11',
                        color: diag ? '#FFD60A' : '#F8F8F8',
                        fontWeight: diag ? 700 : 400,
                      }}
                    >
                      {editing ? (
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={draft[i][j]}
                          onChange={(e) => setCell(i, j, e.target.value)}
                          className="w-14 rounded border border-[#27272A] bg-[#0B0C0D] px-2 py-1 text-center font-mono text-sm focus:border-[#FFD60A] focus:outline-none"
                          style={{ color: diag ? '#FFD60A' : '#F8F8F8', fontWeight: diag ? 700 : 400 }}
                        />
                      ) : (
                        values[i][j] ?? '—'
                      )}
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

// Interactive ODA pill: click toggles YES↔NO, PUTs the change, shows "Saved" 2s.
// Keyed by pincode at the call site so it remounts with fresh data on page/search change.
function OdaCell({ pincode, initial }) {
  const ui = useUI()
  const [value, setValue] = useState(initial)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (busy) return
    const prev = value
    const next = value === 'YES' ? 'NO' : 'YES'
    setBusy(true)
    setValue(next) // optimistic
    try {
      await sendJSON('/api/edit/pincode', 'PUT', { pincode, oda: next })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setValue(prev) // revert on failure
      ui?.toast('error', `Couldn’t update ${pincode}: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const ok = value === 'YES'
  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={busy}
        title="Toggle ODA (YES ↔ NO)"
        style={{
          padding: '2px 10px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          border: 'none',
          cursor: busy ? 'default' : 'pointer',
          color: ok ? '#4ADE80' : '#94A3B8',
          background: ok ? 'rgba(74,222,128,0.15)' : 'rgba(148,163,184,0.15)',
        }}
      >
        {value}
      </button>
      {saved && <span className="text-[11px] font-medium text-[#4ADE80]">Saved</span>}
    </span>
  )
}

const PINCODE_COLUMNS = [
  { key: 'pincode', label: 'Pincode' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zone', label: 'Zone' },
  { key: 'oda', label: 'ODA', render: (v, row) => <OdaCell key={row.pincode} pincode={row.pincode} initial={v} /> },
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
          <span className="font-mono text-[#F8F8F8]">{total.toLocaleString()}</span> pincodes · tap a pill to toggle ODA
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
      <PageHeader title="Edit" subtitle="Reference data · editable" showUpload={false} />

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
