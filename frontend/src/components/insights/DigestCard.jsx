import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Skeleton from '../Skeleton.jsx'
import { fetchJSON } from '../../lib/api.js'

const TEN_MIN = 10 * 60 * 1000

// Keyword → sentiment (INSIGHTS_SPEC §3.1). First matching keyword by position wins,
// so "volume down 8%" reads negative and "E+OT improved" reads positive.
const POS = ['improved', 'improve', 'grew', 'growth', 'gainer', 'gained', 'better', 'up ', 'recovered', 'standout']
const NEG = ['fell', 'dropped', 'drop', 'rose', 'worse', 'worsen', 'lost', 'zero', '0 order', 'silent', 'churn', 'deteriorat', 'collaps', 'decline', 'down ', 'slipped']

function sentiment(text) {
  const t = ` ${text.toLowerCase()} `
  let best = null // { kind, idx }
  for (const w of POS) {
    const i = t.indexOf(w)
    if (i >= 0 && (best === null || i < best.idx)) best = { kind: 'pos', idx: i }
  }
  for (const w of NEG) {
    const i = t.indexOf(w)
    if (i >= 0 && (best === null || i < best.idx)) best = { kind: 'neg', idx: i }
  }
  return best ? best.kind : 'neutral'
}

const MARK = {
  pos: { glyph: '▲', color: '#4ADE80' },
  neg: { glyph: '▼', color: '#F87171' },
  neutral: { glyph: '●', color: '#71717A' },
}

function fmtDate(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return String(iso).slice(0, 10)
  }
}

export default function DigestCard() {
  const [open, setOpen] = useState(true)
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
              const m = MARK[sentiment(b)]
              return (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#E4E4E7]">
                  <span className="mt-px shrink-0 font-mono text-xs" style={{ color: m.color }}>{m.glyph}</span>
                  <span>{b}</span>
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
