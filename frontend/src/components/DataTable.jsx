import { Fragment, useMemo, useState } from 'react'

// Reusable table (UI_DESIGN_SPEC §4): sortable headers with yellow indicator,
// zebra striping, sticky header, numeric right-align + mono, search/export/expand
// toolbar, optional expandable rows, empty state.

const Icon = {
  search: (p) => (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M11 11l3 3" strokeLinecap="round" />
    </svg>
  ),
  download: (p) => (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M8 2v8M5 7l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12v1.5h10V12" strokeLinecap="round" />
    </svg>
  ),
  expand: (p) => (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  close: (p) => (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  ),
}

function IconButton({ children, active, ...rest }) {
  return (
    <button
      {...rest}
      className="flex h-8 w-8 items-center justify-center rounded-md text-[#8A8A93] transition-colors hover:bg-[#1A1A1F] hover:text-[#F8F8F8]"
      style={active ? { color: '#F8F8F8', background: '#1A1A1F' } : undefined}
    >
      {children}
    </button>
  )
}

export default function DataTable({
  columns,
  data = [],
  defaultSort = null, // { key, direction: 'asc' | 'desc' }
  sort: controlledSort, // optional controlled sort
  onSortChange, // if provided → controlled mode
  onExport,
  exportLabel = 'Export Excel',
  renderExpanded = null,
}) {
  const [internalSort, setInternalSort] = useState(defaultSort)
  const sort = controlledSort !== undefined ? controlledSort : internalSort
  const applySort = onSortChange || setInternalSort
  const [expanded, setExpanded] = useState(null)
  const [query, setQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  // A column is "numeric" (right-aligned + mono) when it has no custom render
  // and its first present value is a number.
  const numericKeys = useMemo(() => {
    const set = new Set()
    for (const col of columns) {
      if (col.render) continue
      if (col.numeric === false) continue
      const sample = data.find((r) => r[col.key] != null)
      if (col.numeric === true || (sample && typeof sample[col.key] === 'number')) set.add(col.key)
    }
    return set
  }, [columns, data])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter((row) =>
      columns.some((c) => {
        const v = row[c.key]
        return v != null && String(v).toLowerCase().includes(q)
      }),
    )
  }, [data, query, columns])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const { key, direction } = sort
    const dir = direction === 'desc' ? -1 : 1
    return [...filtered].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir
    })
  }, [filtered, sort])

  function toggleSort(key) {
    const next =
      !sort || sort.key !== key
        ? { key, direction: 'asc' }
        : sort.direction === 'asc'
          ? { key, direction: 'desc' }
          : null
    applySort(next)
  }

  const table = (
    <div
      className="overflow-auto rounded-xl border border-[#27272A]"
      style={{ maxHeight: fullscreen ? '82vh' : 600 }}
    >
      <table className="w-full border-collapse" style={{ fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map((col) => {
              const active = sort?.key === col.key
              const isNum = numericKeys.has(col.key)
              return (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap border-b border-[#27272A] bg-[#15151A] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] hover:text-[#F8F8F8] ${
                    isNum ? 'text-right' : 'text-left'
                  }`}
                  style={{ color: active ? '#F8F8F8' : '#8A8A93' }}
                >
                  {col.label}
                  {active && (
                    <span style={{ color: '#B18AFF' }}>
                      {sort.direction === 'asc' ? ' ▲' : ' ▼'}
                    </span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-[#8A8A93]">
                No data available
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => {
              const rowKey = row.lrn ?? row.company ?? i
              const isExp = renderExpanded && expanded === rowKey
              return (
                <Fragment key={rowKey}>
                  <tr
                    onClick={renderExpanded ? () => setExpanded(isExp ? null : rowKey) : undefined}
                    className={`${i % 2 === 0 ? 'bg-[#0F0F11]' : 'bg-[#131316]'} transition-colors hover:bg-[#1A1A1F] ${
                      renderExpanded ? 'cursor-pointer' : ''
                    }`}
                  >
                    {columns.map((col) => {
                      const raw = row[col.key]
                      const isNum = numericKeys.has(col.key)
                      const isLrn = col.key === 'lrn'
                      return (
                        <td
                          key={col.key}
                          className={`whitespace-nowrap border-b border-[#1F1F23] px-4 py-2.5 ${
                            isNum ? 'text-right font-mono' : 'text-left'
                          } ${isLrn ? 'font-mono' : ''}`}
                          style={{ color: isLrn ? '#A1A1AA' : '#F8F8F8' }}
                        >
                          {col.render ? col.render(raw, row) : raw ?? '—'}
                        </td>
                      )
                    })}
                  </tr>
                  {isExp && (
                    <tr className="bg-[#0B0B0D]">
                      <td colSpan={columns.length} className="border-b border-[#27272A] px-4 py-4">
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )

  const toolbar = (
    <div className="mb-2 flex items-center justify-end gap-1">
      {showSearch && (
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter rows…"
          className="mr-1 w-48 rounded-md border border-[#27272A] bg-[#15151A] px-2 py-1.5 text-sm text-[#F8F8F8] placeholder:text-[#8A8A93] focus:border-[#3F3F46] focus:outline-none"
        />
      )}
      <IconButton active={showSearch} title="Search" onClick={() => setShowSearch((s) => !s)}>
        <Icon.search />
      </IconButton>
      {onExport && (
        <IconButton title={exportLabel} onClick={onExport}>
          <Icon.download />
        </IconButton>
      )}
      <IconButton active={fullscreen} title="Expand" onClick={() => setFullscreen((f) => !f)}>
        {fullscreen ? <Icon.close /> : <Icon.expand />}
      </IconButton>
    </div>
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-6 md:p-10" onClick={() => setFullscreen(false)}>
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {toolbar}
          {table}
        </div>
      </div>
    )
  }

  return (
    <div>
      {toolbar}
      {table}
    </div>
  )
}
