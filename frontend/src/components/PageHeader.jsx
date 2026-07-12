import { useUI } from '../context/ui.jsx'

// Consistent page header (UI_DESIGN_SPEC §10.2): title + subtitle left,
// "↑ Upload new file(s)" right (omitted on Edit via showUpload={false}).
export default function PageHeader({ title, subtitle, showUpload = true }) {
  const ui = useUI()
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <h1 className="text-[26px] font-bold leading-tight text-[#F8F8F8]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[#71717A]">{subtitle}</p>}
      </div>
      {showUpload && (
        <button
          onClick={() => ui?.openUpload?.()}
          className="shrink-0 rounded-lg border border-[#27272A] bg-transparent px-4 py-2.5 text-sm text-[#F8F8F8] transition-colors hover:border-[#3F3F46]"
        >
          ↑ Upload new file(s)
        </button>
      )}
    </div>
  )
}
