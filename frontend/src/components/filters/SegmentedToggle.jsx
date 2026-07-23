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
                ? { background: 'rgba(177, 138, 255,0.1)', color: '#B18AFF', boxShadow: 'inset 0 0 0 1px #B18AFF' }
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
