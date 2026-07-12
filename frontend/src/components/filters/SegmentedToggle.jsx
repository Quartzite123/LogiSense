// Pill segmented control (UI_DESIGN_SPEC §5.2). Active segment = yellow tint.
export default function SegmentedToggle({ options, value, onChange }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-[#27272A]">
      {options.map((o) => {
        const active = o === value
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className="px-[18px] py-2 text-sm transition-colors"
            style={
              active
                ? { background: 'rgba(255,214,10,0.1)', color: '#FFD60A', boxShadow: 'inset 0 0 0 1px #FFD60A' }
                : { background: 'transparent', color: '#A1A1AA' }
            }
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}
