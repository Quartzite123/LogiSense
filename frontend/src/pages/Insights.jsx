import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../components/PageHeader.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Skeleton from '../components/Skeleton.jsx'
import DigestCard from '../components/insights/DigestCard.jsx'
import PatternCard from '../components/insights/PatternCard.jsx'
import ChatPanel from '../components/insights/ChatPanel.jsx'
import { fetchJSON } from '../lib/api.js'

const TEN_MIN = 10 * 60 * 1000
const TOP_N = 6

function SectionLabel({ children }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8A8A93]">{children}</h2>
  )
}

function PatternSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} height={168} style={{ borderRadius: 12 }} />
      ))}
    </div>
  )
}

export default function Insights() {
  const [showAll, setShowAll] = useState(false)

  const patterns = useQuery({
    queryKey: ['insights-patterns'],
    queryFn: () => fetchJSON('/api/insights/patterns'),
    staleTime: TEN_MIN,
  })
  // Overall ODA share for the "(vs X% overall)" line in root-cause panels.
  const kpis = useQuery({
    queryKey: ['landing', 'kpis'],
    queryFn: () => fetchJSON('/api/landing/kpis'),
  })
  const overallOdaPct =
    kpis.data && kpis.data.total > 0 ? (kpis.data.oda_count / kpis.data.total) * 100 : null

  const list = patterns.data?.patterns || []
  const hasData = patterns.data?.snapshot_id != null
  const visible = showAll ? list : list.slice(0, TOP_N)

  return (
    <div className="page-container mx-auto flex max-w-[1600px] flex-col gap-8 px-10 py-8">
      <PageHeader title="AI Insights" subtitle="Patterns · Changes · Chat" />

      {patterns.isError ? (
        <div className="rounded-lg border border-[#F87171]/50 bg-[#F87171]/10 p-5 text-sm">
          <div className="font-medium text-[#F87171]">Couldn’t load insights.</div>
          <div className="mt-1 text-[#8A8A93]">{String(patterns.error?.message)} — is the backend running on :8000?</div>
          <button onClick={() => patterns.refetch()} className="mt-3 rounded-md border border-[#27272A] bg-[#15151A] px-3 py-1.5 text-[#F8F8F8] hover:border-[#B18AFF]">
            Retry
          </button>
        </div>
      ) : patterns.isLoading ? (
        <>
          <Skeleton height={150} style={{ borderRadius: 12 }} />
          <div className="flex flex-col gap-4">
            <SectionLabel>Detected Patterns</SectionLabel>
            <PatternSkeletons />
          </div>
        </>
      ) : !hasData ? (
        <EmptyState message="Upload a Delhivery file to generate insights" />
      ) : (
        <>
          <DigestCard />

          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <SectionLabel>Detected Patterns</SectionLabel>
              <span className="text-[11px] text-[#52525B]">{list.length} found</span>
            </div>

            {visible.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#27272A] bg-[#0F0F11] p-8 text-center text-sm text-[#8A8A93]">
                No patterns detected in the current data.
              </div>
            ) : (
              <div className="ls-stagger grid grid-cols-1 gap-4 md:grid-cols-2">
                {visible.map((p) => (
                  <PatternCard key={p.id} pattern={p} overallOdaPct={overallOdaPct} />
                ))}
              </div>
            )}

            {list.length > TOP_N && (
              <button
                onClick={() => setShowAll((s) => !s)}
                className="self-center rounded-lg border border-[#27272A] bg-[#15151A] px-4 py-2 text-sm text-[#D4D4D8] transition-colors hover:border-[#B18AFF] hover:text-[#F8F8F8]"
              >
                {showAll ? 'Show fewer ▴' : `Show all ${list.length} patterns ▾`}
              </button>
            )}
          </section>

          <ChatPanel />
        </>
      )}
    </div>
  )
}
