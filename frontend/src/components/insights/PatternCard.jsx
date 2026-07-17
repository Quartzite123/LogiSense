import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import RootCausePanel from './RootCausePanel.jsx'
import { fetchJSON } from '../../lib/api.js'

// Severity → left border + badge (INSIGHTS_SPEC §3.2).
const SEV = {
  red: { border: '#F87171', label: 'CHURN RISK', bg: 'rgba(248,113,113,0.15)' },
  yellow: { border: '#FBBF24', label: 'WATCH', bg: 'rgba(251,191,36,0.15)' },
  green: { border: '#4ADE80', label: 'GROWTH', bg: 'rgba(74,222,128,0.15)' },
  grey: { border: '#71717A', label: 'INFO', bg: 'rgba(113,113,122,0.15)' },
}

export default function PatternCard({ pattern, overallOdaPct }) {
  const [open, setOpen] = useState(false)
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
      className="overflow-hidden rounded-xl border border-[#27272A] bg-[#0F0F11]"
      style={{ borderLeft: `4px solid ${sev.border}` }}
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
            <span className="text-[11px] font-medium uppercase tracking-wide text-[#71717A]">
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
            className="mt-3.5 text-[13px] font-medium text-[#FFD60A] hover:text-[#FFE566]"
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
