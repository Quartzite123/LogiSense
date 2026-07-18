import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiUrl } from '../lib/api.js'

// Global upload modal (UIDESIGN §10). The header "Upload" button opens this via
// the UI context. The backend replaces all data per upload.
export default function UploadModal({ open, onClose, onResult }) {
  const queryClient = useQueryClient()
  const inputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const addFiles = (list) => {
    const arr = Array.from(list || []).filter((f) => /\.(xlsx|xls)$/i.test(f.name))
    if (arr.length) setFiles((prev) => [...prev, ...arr])
  }
  const removeFile = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))
  const close = () => {
    if (busy) return
    setFiles([])
    onClose()
  }

  async function process() {
    if (!files.length || busy) return
    setBusy(true)
    try {
      // Backend clears + ingests per call (always-replace). Process the first
      // selected file's batch; the warning makes the replace semantics clear.
      const fd = new FormData()
      fd.append('file', files[0])
      const res = await fetch(apiUrl('/api/upload'), { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || `Upload failed (HTTP ${res.status})`)
      }
      const data = await res.json()
      queryClient.invalidateQueries() // refresh every section
      onResult('success', `${Number(data.rows_inserted).toLocaleString()} rows processed`)
      setFiles([])
      onClose()
    } catch (e) {
      onResult('error', e.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={close}>
      <div
        className="w-full max-w-[520px] rounded-2xl border border-[#27272A] bg-[#0F0F11] p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#F8F8F8]">Upload Delhivery file(s)</h2>
          <button onClick={close} className="text-[#71717A] hover:text-[#F8F8F8]" aria-label="Close">
            ×
          </button>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            addFiles(e.dataTransfer.files)
          }}
          className="cursor-pointer rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors"
          style={{
            borderColor: dragOver ? '#FFD60A' : '#27272A',
            background: dragOver ? 'rgba(255,214,10,0.04)' : 'transparent',
          }}
        >
          <div className="text-2xl text-[#71717A]">↑</div>
          <div className="mt-2 text-sm font-medium text-[#F8F8F8]">Drag &amp; drop .xlsx files here</div>
          <div className="mt-1 text-xs text-[#71717A]">or click to browse</div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 rounded-md border border-[#27272A] bg-[#15151A] px-2.5 py-1 text-xs text-[#F8F8F8]"
              >
                {f.name} · {(f.size / 1024).toFixed(0)} KB
                <button onClick={() => removeFile(i)} className="text-[#71717A] hover:text-[#F87171]">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <p className="mt-4 text-xs" style={{ color: '#FBBF24' }}>
          Each upload replaces all existing data.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={close}
            disabled={busy}
            className="rounded-lg border border-[#27272A] px-4 py-2 text-sm text-[#F8F8F8] hover:border-[#3F3F46] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={process}
            disabled={!files.length || busy}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: '#FFD60A' }}
          >
            {busy && (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/40 border-t-black" />
            )}
            {busy ? 'Processing…' : 'Process & Update'}
          </button>
        </div>
      </div>
    </div>
  )
}
