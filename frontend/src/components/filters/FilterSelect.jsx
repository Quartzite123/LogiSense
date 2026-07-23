import { useState } from 'react'

// Multiselect dropdown with All/Clear + yellow-tint chips (UI_DESIGN_SPEC §5.3).
export default function FilterSelect({
  label,
  hint = 'empty = all',
  options,
  value = [],
  onChange,
}) {
  const [open, setOpen] = useState(false)
  const sel = Array.isArray(value) ? value : value ? [value] : []
  const toggle = (o) => onChange(sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o])

  return (
    <div className="min-w-[180px]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs text-[#A1A1AA]">
          {label} <span className="text-[#8A8A93]">({hint})</span>
        </span>
        <span className="flex gap-2">
          <button onClick={() => onChange(options.slice())} className="text-[11px] text-[#8A8A93] hover:text-[#B18AFF]">
            All
          </button>
          <button onClick={() => onChange([])} className="text-[11px] text-[#8A8A93] hover:text-[#B18AFF]">
            Clear
          </button>
        </span>
      </div>

      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-lg border border-[#27272A] bg-[#15151A] px-3 py-2 text-left text-sm text-[#F8F8F8] hover:border-[#3F3F46]"
        >
          <span>{sel.length ? `${sel.length} selected` : 'All'}</span>
          <span className="text-[#8A8A93]">▾</span>
        </button>
        {open && (
          <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[#27272A] bg-[#15151A] p-1 shadow-xl">
            {options.map((o) => (
              <label
                key={o}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-[#F8F8F8] hover:bg-[#1A1A1F]"
              >
                <input type="checkbox" checked={sel.includes(o)} onChange={() => toggle(o)} />
                {o}
              </label>
            ))}
          </div>
        )}
      </div>

      {sel.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {sel.map((o) => (
            <span
              key={o}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px]"
              style={{ background: 'rgba(177, 138, 255,0.12)', color: '#B18AFF' }}
            >
              {o}
              <button onClick={() => toggle(o)} className="hover:text-white">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
