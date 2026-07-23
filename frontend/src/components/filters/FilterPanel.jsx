import { useState } from 'react'

// Collapsible filter container (UI_DESIGN_SPEC §5.1).
export default function FilterPanel({ children, defaultOpen = true, right = null }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-[#27272A] bg-[#0F0F11]" style={{ padding: '20px 24px' }}>
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-sm font-semibold text-[#F8F8F8]">
          Filters <span className="text-[#8A8A93]">{open ? '▲' : '▼'}</span>
        </button>
        {right}
      </div>
      {open && <div className="mt-4">{children}</div>}
    </div>
  )
}
