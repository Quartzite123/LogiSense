import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import RootCausePanel from './RootCausePanel.jsx'
import { fetchJSON } from '../../lib/api.js'

// Severity → left border + badge (INSIGHTS_SPEC §3.2). `wash` is a very low-opacity
// tint of the same colour, bled in from the left edge so severity reads at a glance
// without changing what any severity colour *means*.
const SEV = {
  red: { border: '#F87171', label: 'CHURN RISK', bg: 'rgba(248,113,113,0.15)', wash: 'rgba(248,113,113,0.07)' },
  yellow: { border: '#FBBF24', label: 'WATCH', bg: 'rgba(251,191,36,0.15)', wash: 'rgba(251,191,36,0.06)' },
  green: { border: '#4ADE80', label: 'GROWTH', bg: 'rgba(74,222,128,0.15)', wash: 'rgba(74,222,128,0.06)' },
  grey: { border: '#71717A', label: 'INFO', bg: 'rgba(113,113,122,0.15)', wash: 'rgba(113,113,122,0.06)' },
}

export default function PatternCard({ pattern, overallOdaPct }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const sev = SEV[pattern.severity] || SEV.grey
  const canExpand = pattern.has_root_cause && pattern.company
  // Drop any stray field-name bullets (e.g. "Severity level: red") the LLM may emit.
  const cleanBullets = (pattern.bullets || []).filter((b) => !b.toLowerCase().includes('severity'))

  const rc = useQuery({
    queryKey: ['root-cause', pattern.company],
    queryFn: () => fetchJSON(`/api/insights/root-cause?company=${encodeURIComponent(pattern.company)}`),
    enabled: open && Boolean(canExpand),
    staleTime: 10 * 60 * 1000,
  })

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="overflow-hidden rounded-xl border border-[#27272A]"
      style={{
        // Severity wash over the base surface; the left border keeps its exact colour.
        background: `linear-gradient(100deg, ${sev.wash} 0%, rgba(0,0,0,0) 55%), #0F0F11`,
        borderLeft: `4px solid ${sev.border}`,
        borderTopColor: hover ? '#3F3F46' : '#27272A',
        borderRightColor: hover ? '#3F3F46' : '#27272A',
        borderBottomColor: hover ? '#3F3F46' : '#27272A',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hover ? '0 10px 26px -14px rgba(0,0,0,0.85)' : 'none',
        transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
      }}
    >
      <div style={{ padding: '20px 24px' }}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: sev.border, background: sev.bg }}
          >
            {sev.label}
          </span>
          {pattern.company && (
            <span className="text-[11px] font-medium uppercase tracking-wide text-[#8A8A93]">
              {pattern.company}
            </span>
          )}
        </div>

        <h3 className="mt-2.5 text-base font-semibold leading-snug text-[#F8F8F8]">
          {pattern.headline}
        </h3>

        <ul className="mt-3 flex flex-col gap-1.5">
          {cleanBullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-[#A1A1AA]">
              <span className="mt-1 shrink-0 text-[#52525B]">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {canExpand && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="ls-focus mt-3.5 rounded text-[13px] font-medium text-[#B18AFF] transition-colors hover:text-[#D0BAFF]"
          >
            <span className={`mr-1 inline-block transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
            {open ? 'Hide analysis' : 'Why is this happening?'}
          </button>
        )}
      </div>

      {open && canExpand && (
        <RootCausePanel
          loading={rc.isLoading}
          error={rc.isError}
          data={rc.data}
          overallOdaPct={overallOdaPct}
        />
      )}
    </div>
  )
}
