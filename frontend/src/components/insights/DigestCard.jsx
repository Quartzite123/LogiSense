import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Skeleton from '../Skeleton.jsx'
import { fetchJSON } from '../../lib/api.js'
import { useIsMobile } from '../../lib/useIsMobile.js'

const TEN_MIN = 10 * 60 * 1000

// Digest bullets show a ▲/▼/● indicator. The Groq narrator already prefixes each
// bullet with a glyph, so we honour that leading glyph first; the deterministic
// fallback has no prefix, so we scan the whole bullet for sentiment keywords.
// A leading glyph is stripped before display (stripLead) so it isn't doubled.
const POSITIVE = ['improved', 'increased', 'up ', 'grew', 'better', 'gained', 'higher', 'gainer', 'standout', 'recovered']
const NEGATIVE = ['fell', 'dropped', 'decreased', 'down ', 'worse', 'lost', 'zero', 'churned', 'deteriorat', 'declined', 'risk', 'slipped', 'silent']

function getIndicator(bullet) {
  const lead = bullet.trim().charAt(0)
  if (lead === '▲') return { symbol: '▲', color: '#4ADE80' }
  if (lead === '▼') return { symbol: '▼', color: '#F87171' }
  if (lead === '●') return { symbol: '●', color: '#71717A' }
  const lower = bullet.toLowerCase()
  if (POSITIVE.some((w) => lower.includes(w))) return { symbol: '▲', color: '#4ADE80' }
  if (NEGATIVE.some((w) => lower.includes(w))) return { symbol: '▼', color: '#F87171' }
  return { symbol: '●', color: '#71717A' }
}

const stripLead = (b) => b.replace(/^\s*[▲▼●]\s*/, '')

function fmtDate(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return String(iso).slice(0, 10)
  }
}

export default function DigestCard() {
  const isMobile = useIsMobile()
  // Collapsed by default on mobile (INSIGHTS_SPEC §3.1), expanded on desktop.
  const [open, setOpen] = useState(!isMobile)
  // Re-sync when the viewport crosses 768px (e.g. DevTools device toggle after
  // load) — otherwise the once-only useState initializer keeps a stale value.
  useEffect(() => {
    setOpen(!isMobile)
  }, [isMobile])
  const q = useQuery({
    queryKey: ['insights-digest'],
    queryFn: () => fetchJSON('/api/insights/digest'),
    staleTime: TEN_MIN,
  })

  const cardCls = 'rounded-xl border border-[#27272A] bg-[#0F0F11]'
  const style = { padding: '20px 24px' }

  if (q.isLoading) {
    return (
      <div className={cardCls} style={style}>
        <Skeleton height={18} width={260} />
        <div className="mt-4 flex flex-col gap-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={14} width={`${88 - i * 6}%`} />
          ))}
        </div>
      </div>
    )
  }

  if (q.isError) {
    return (
      <div className={cardCls} style={style}>
        <div className="text-sm text-[#F87171]">Couldn’t load the digest.</div>
        <button onClick={() => q.refetch()} className="mt-2 rounded-md border border-[#27272A] bg-[#15151A] px-3 py-1 text-xs text-[#F8F8F8] hover:border-[#FFD60A]">
          Retry
        </button>
      </div>
    )
  }

  const data = q.data || {}
  const bullets = data.digest

  // First upload / no comparison available.
  if (!bullets || !bullets.length) {
    return (
      <div className={cardCls} style={style}>
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <h2 className="text-[15px] font-semibold text-[#F8F8F8]">First upload — baseline established</h2>
        </div>
        <p className="mt-1.5 text-sm text-[#71717A]">
          {data.message || 'Upload another file and I’ll show you what changed.'}
        </p>
      </div>
    )
  }

  const n = data.snapshot_id
  const prevDate = fmtDate(data.previous_uploaded_at)

  return (
    <div className={cardCls} style={style}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <h2 className="text-[15px] font-semibold text-[#F8F8F8]">
            What Changed{n ? ` — Upload #${n} vs Upload #${n - 1}` : ''}
          </h2>
        </div>
        <span className={`text-xs text-[#71717A] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <>
          <ul className="mt-4 flex flex-col gap-2.5">
            {bullets.map((b, i) => {
              const ind = getIndicator(b)
              return (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#E4E4E7]">
                  <span className="mt-px shrink-0 font-mono text-xs" style={{ color: ind.color }}>{ind.symbol}</span>
                  <span>{stripLead(b)}</span>
                </li>
              )
            })}
          </ul>
          {prevDate && (
            <p className="mt-4 text-xs text-[#71717A]">Compared to data from {prevDate}</p>
          )}
        </>
      )}
    </div>
  )
}
