import { useUI } from '../context/ui.jsx'

// Shown only when the DB confirms zero rows (UI_DESIGN_SPEC §10.6).
export default function EmptyState({ message = 'Upload a Delhivery export to get started' }) {
  const ui = useUI()
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#27272A] bg-[#0F0F11] py-20 text-center">
      <div className="font-mono text-4xl font-bold text-[#8A8A93]">∅</div>
      <h2 className="mt-3 text-lg font-semibold text-[#F8F8F8]">No data yet</h2>
      <p className="mt-1 text-sm text-[#8A8A93]">{message}</p>
      <button
        onClick={() => ui?.openUpload?.()}
        className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-black"
        style={{ background: '#B18AFF' }}
      >
        ↑ Upload new file(s)
      </button>
    </div>
  )
}
