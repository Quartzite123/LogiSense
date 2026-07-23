import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { apiUrl, fetchJSON, sendJSON } from '../lib/api.js'
import { useUI } from '../context/ui.jsx'

const BTN_PRIMARY = 'rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50'
const BTN_SECONDARY =
  'rounded-lg border border-[#27272A] bg-[#15151A] px-4 py-2 text-sm text-[#F8F8F8] hover:border-[#3F3F46] disabled:opacity-50'

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

  async function reset() {
    if (!window.confirm('Reset matrix to original values? This cannot be undone.')) return
    setSaving(true)
    try {
      await sendJSON('/api/edit/matrix/reset', 'POST', {})
      ui?.toast('success', 'Matrix reset to original values')
      setEditing(false)
      setDraft(null)
      qc.invalidateQueries({ queryKey: ['edit', 'matrix'] })
    } catch (e) {
      ui?.toast('error', e.message || 'Reset failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#27272A] bg-[#0F0F11] p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="max-w-2xl text-xs text-[#8A8A93]">
          Diagonal = intra-zone TAT (yellow-tinted). Values are days (1–30). Edits affect future uploads
          only — past shipments keep their already-stored Expected TAT.
        </p>
        {editing ? (
          <div className="flex shrink-0 gap-2">
            <button onClick={save} disabled={saving} className={BTN_PRIMARY} style={{ background: '#B18AFF' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button onClick={cancel} disabled={saving} className={BTN_SECONDARY}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 gap-2">
            <button onClick={startEdit} className={BTN_PRIMARY} style={{ background: '#B18AFF' }}>
              Edit matrix
            </button>
            <button onClick={reset} disabled={saving} className={BTN_SECONDARY}>
              Reset to defaults
            </button>
          </div>
        )}
      </div>

      <div className="overflow-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-[#27272A] bg-[#15151A] px-4 py-2.5 text-left text-[11px] uppercase tracking-wide text-[#8A8A93]">
                Origin ↓ / Dest →
              </th>
              {zones.map((z) => (
                <th key={z} className="border border-[#27272A] bg-[#15151A] px-4 py-2.5 text-center text-[11px] uppercase tracking-wide text-[#8A8A93]">
                  {z}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zones.map((origin, i) => (
              <tr key={origin}>
                <td className="border border-[#27272A] bg-[#15151A] px-4 py-2.5 text-[11px] uppercase tracking-wide text-[#8A8A93]">{origin}</td>
                {zones.map((_, j) => {
                  const diag = i === j
                  return (
                    <td
                      key={j}
                      className="border border-[#27272A] px-3 py-2 text-center font-mono"
                      style={{
                        background: diag ? 'rgba(177, 138, 255,0.08)' : '#0F0F11',
                        color: diag ? '#B18AFF' : '#F8F8F8',
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
                          className="w-14 rounded border border-[#27272A] bg-[#0B0C0D] px-2 py-1 text-center font-mono text-sm focus:border-[#B18AFF] focus:outline-none"
                          style={{ color: diag ? '#B18AFF' : '#F8F8F8', fontWeight: diag ? 700 : 400 }}
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
  const ui = useUI()
  const qc = useQueryClient()
  const fileRef = useRef(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const perPage = 50

  const q = useQuery({
    queryKey: ['edit', 'pincodes', page, search],
    queryFn: () => fetchJSON(`/api/edit/pincodes?page=${page}&per_page=${perPage}&search=${encodeURIComponent(search)}`),
    keepPreviousData: true,
  })

  const total = q.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const refresh = () => qc.invalidateQueries({ queryKey: ['edit', 'pincodes'] })

  async function resetPincodes() {
    if (!window.confirm('Reset all pincode ODA values to original? This cannot be undone.')) return
    setResetting(true)
    try {
      const data = await sendJSON('/api/edit/pincodes/reset', 'POST', {})
      ui?.toast('success', `Pincode master reset — ${Number(data.rows_reset).toLocaleString()} pincodes restored`)
      setSearch('')
      setPage(1)
      refresh()
    } catch (e) {
      ui?.toast('error', e.message || 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  async function uploadCustom() {
    if (!file || uploading) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(apiUrl('/api/edit/pincodes/upload'), { method: 'POST', credentials: 'include', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || `Upload failed (HTTP ${res.status})`)
      ui?.toast('success', `${Number(data.rows_loaded).toLocaleString()} pincodes loaded — pincode master updated`)
      setFile(null)
      setSearch('')
      setPage(1)
      refresh()
    } catch (e) {
      ui?.toast('error', e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Custom pincode file upload */}
      <div className="rounded-xl border-2 border-dashed border-[#27272A] p-5">
        <div className="text-sm font-medium text-[#F8F8F8]">Upload a custom pincode master (.xlsx)</div>
        <div className="mt-1 text-xs text-[#8A8A93]">Required columns: pincode, city, state, zone, oda</div>
        <div className="text-xs text-[#8A8A93]">Minimum 100 rows · Replaces current master for this session</div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={() => fileRef.current?.click()} className={BTN_SECONDARY}>
            Choose file
          </button>
          {file && (
            <>
              <span className="text-xs text-[#A1A1AA]">{file.name}</span>
              <button
                onClick={uploadCustom}
                disabled={uploading}
                className={BTN_PRIMARY}
                style={{ background: '#B18AFF' }}
              >
                {uploading ? 'Uploading…' : 'Upload & Replace'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search + count + reset */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Search pincode / city / state…"
          className="w-72 rounded-md border border-[#27272A] bg-[#15151A] px-3 py-2 text-sm text-[#F8F8F8] placeholder:text-[#8A8A93] focus:border-[#3F3F46] focus:outline-none"
        />
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#8A8A93]">
            <span className="font-mono text-[#F8F8F8]">{total.toLocaleString()}</span> pincodes
          </span>
          <button onClick={resetPincodes} disabled={resetting} className={BTN_SECONDARY}>
            {resetting ? 'Resetting…' : 'Reset to defaults'}
          </button>
        </div>
      </div>

      {/* Edit hint */}
      <p className="text-xs text-[#8A8A93]">
        Click an ODA pill to toggle YES/NO — search results are editable too. Changes save instantly (this session only).
      </p>

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
        <span className="text-[#8A8A93]">
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
                color: active ? '#F8F8F8' : '#8A8A93',
                borderBottom: active ? '2px solid #B18AFF' : '2px solid transparent',
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
