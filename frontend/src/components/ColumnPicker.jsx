import { useState } from 'react'
import SegmentedToggle from './filters/SegmentedToggle.jsx'

// Column show/hide pills + Sort By/Direction controls in one collapsible panel
// (UI_DESIGN_SPEC §6, §7). Sort props are optional.
export default function ColumnPicker({
  allColumns,
  visibleColumns,
  onChange,
  defaultColumns,
  sortBy = null,
  sortDir = 'asc',
  onSortBy,
  onSortDir,
}) {
  const [open, setOpen] = useState(false)
  const labelOf = (k) => allColumns.find((c) => c.key === k)?.label || k
  const hidden = allColumns.filter((c) => !visibleColumns.includes(c.key))

  return (
    <div className="rounded-xl border border-[#27272A] bg-[#0F0F11] px-5 py-4">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <span className="text-sm font-semibold text-[#F8F8F8]">Columns &amp; Sort</span>
        <span className="text-[#71717A]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3">
          <div className="text-xs text-[#71717A]">Click × to hide · use the dropdown to show</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {visibleColumns.map((k) => (
              <span
                key={k}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs"
                style={{ background: 'rgba(255,214,10,0.12)', color: '#FFD60A' }}
              >
                {labelOf(k)}
                <button onClick={() => onChange(visibleColumns.filter((x) => x !== k))} className="hover:text-white">
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {hidden.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onChange([...visibleColumns, e.target.value])
                }}
                className="rounded-md border border-[#27272A] bg-[#15151A] px-2 py-1.5 text-sm text-[#F8F8F8]"
              >
                <option value="" disabled>
                  + Add column…
                </option>
                {hidden.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => onChange(allColumns.map((c) => c.key))}
              className="rounded-md border border-[#27272A] px-3 py-1.5 text-sm text-[#F8F8F8] hover:border-[#3F3F46]"
            >
              Show all columns
            </button>
            <button
              onClick={() => onChange(defaultColumns.slice())}
              className="rounded-md border border-[#27272A] px-3 py-1.5 text-sm text-[#F8F8F8] hover:border-[#3F3F46]"
            >
              Reset to defaults
            </button>
          </div>

          {onSortBy && (
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div>
                <div className="mb-1 text-xs text-[#71717A]">Sort By</div>
                <select
                  value={sortBy || ''}
                  onChange={(e) => onSortBy(e.target.value || null)}
                  className="rounded-md border border-[#27272A] bg-[#15151A] px-2 py-1.5 text-sm text-[#F8F8F8]"
                >
                  <option value="">— none —</option>
                  {visibleColumns.map((k) => (
                    <option key={k} value={k}>
                      {labelOf(k)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1 text-xs text-[#71717A]">Direction</div>
                <SegmentedToggle
                  options={['Asc', 'Desc']}
                  value={sortDir === 'desc' ? 'Desc' : 'Asc'}
                  onChange={(v) => onSortDir(v === 'Desc' ? 'desc' : 'asc')}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
