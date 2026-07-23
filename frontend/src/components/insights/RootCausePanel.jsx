// Inline root-cause expansion shown below a PatternCard (INSIGHTS_SPEC §3.3).
// Data is precomputed at cache time and fetched by the parent PatternCard.
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)

function Row({ label, children }) {
  return (
    <div className="flex gap-3 text-[13px] leading-relaxed">
      <span className="w-[112px] shrink-0 text-[#8A8A93]">{label}</span>
      <span className="text-[#D4D4D8]">{children}</span>
    </div>
  )
}

export default function RootCausePanel({ loading, error, data, overallOdaPct }) {
  const wrap = 'border-t border-[#27272A] bg-[#15151A]'
  const style = { padding: '16px 20px' }

  if (loading) {
    return (
      <div className={wrap} style={style}>
        <div className="flex items-center gap-2 text-[13px] text-[#8A8A93]">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#3F3F46] border-t-[#B18AFF]" />
          Analysing…
        </div>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className={wrap} style={style}>
        <div className="text-[13px] text-[#F87171]">Root-cause analysis unavailable.</div>
      </div>
    )
  }

  const { oda_share, dominant_zone, worst_pincode, worst_pincode_city, worst_pincode_late_pct, narrative } = data

  return (
    <div className={wrap} style={style}>
      <div className="flex flex-col gap-2">
        <Row label="ODA exposure">
          {pct(oda_share)} of orders
          {overallOdaPct != null && (
            <span className="text-[#8A8A93]"> (vs {Math.round(overallOdaPct)}% overall)</span>
          )}
        </Row>
        <Row label="Dominant zone">{dominant_zone || '—'}</Row>
        <Row label="Worst pincode">
          {worst_pincode ? (
            <>
              {worst_pincode}
              {worst_pincode_city ? ` (${worst_pincode_city})` : ''}
              {worst_pincode_late_pct != null && (
                <span className="text-[#F87171]"> — {pct(worst_pincode_late_pct)} late rate</span>
              )}
            </>
          ) : (
            '—'
          )}
        </Row>
        {narrative && (
          <Row label="Assessment">
            <span className="text-[#A1A1AA]">{narrative}</span>
          </Row>
        )}
      </div>
    </div>
  )
}
