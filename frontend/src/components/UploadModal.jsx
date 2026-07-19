import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Lottie from 'lottie-react'
import airplaneAnimation from '../assets/airplane.json'
import { apiUrl } from '../lib/api.js'

// Global upload modal (UIDESIGN §10). The header "Upload" button opens this via
// the UI context. The backend replaces all data per upload.
export default function UploadModal({ open, onClose, onResult }) {
  const queryClient = useQueryClient()
  const inputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null) // row count once processing succeeds

  if (!open) return null

  const addFiles = (list) => {
    const arr = Array.from(list || []).filter((f) => /\.(xlsx|xls)$/i.test(f.name))
    if (arr.length) setFiles((prev) => [...prev, ...arr])
  }
  const removeFile = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))
  const close = () => {
    if (busy) return // don't allow closing mid-processing
    setFiles([])
    setDone(null)
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
      setBusy(false)
      setDone(Number(data.rows_inserted)) // show success state
      // Auto-close after the success state has been seen.
      setTimeout(() => {
        setDone(null)
        setFiles([])
        onClose()
      }, 2500)
    } catch (e) {
      setBusy(false)
      onResult('error', e.message || 'Upload failed')
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
          {!busy && !done && (
            <button onClick={close} className="text-[#71717A] hover:text-[#F8F8F8]" aria-label="Close">
              ×
            </button>
          )}
        </div>

        {busy ? (
          // --- Processing: airplane Lottie ---
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <Lottie animationData={airplaneAnimation} loop style={{ width: 240, height: 240, margin: '0 auto' }} />
            <p style={{ color: '#FFD60A', fontSize: '16px', fontWeight: 600, marginTop: '16px' }}>
              Processing your file...
            </p>
            <p style={{ color: '#71717A', fontSize: '13px', marginTop: '8px' }}>
              Analysing shipments, computing E+OT, generating insights
            </p>
          </div>
        ) : done != null ? (
          // --- Success ---
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <div style={{ fontSize: '48px' }}>✅</div>
            <p style={{ color: '#4ADE80', fontSize: '16px', fontWeight: 600, marginTop: '16px' }}>
              {done.toLocaleString()} shipments processed
            </p>
            <p style={{ color: '#71717A', fontSize: '13px', marginTop: '8px' }}>
              Dashboard updated · Insights regenerating...
            </p>
          </div>
        ) : (
          // --- Idle: drop zone + file list + actions ---
          <>
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
                className="rounded-lg border border-[#27272A] px-4 py-2 text-sm text-[#F8F8F8] hover:border-[#3F3F46]"
              >
                Cancel
              </button>
              <button
                onClick={process}
                disabled={!files.length}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: '#FFD60A' }}
              >
                Process &amp; Update
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
