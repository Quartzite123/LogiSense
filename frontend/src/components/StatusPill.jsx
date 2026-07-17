// Colored rounded pill (UI_DESIGN_SPEC §4.2): status-color text on a 15%-opacity
// background of the same color. Value-driven so it works for delivery / current /
// risk columns alike. `type` is accepted for back-compat but no longer required.

const PILL = {
  Early: ['#4ADE80', 'rgba(74,222,128,0.15)'],
  'On Time': ['#60A5FA', 'rgba(96,165,250,0.15)'],
  Late: ['#F87171', 'rgba(248,113,113,0.15)'],
  Delivered: ['#4ADE80', 'rgba(74,222,128,0.15)'],
  'In Transit': ['#60A5FA', 'rgba(96,165,250,0.15)'],
  Dispatched: ['#60A5FA', 'rgba(96,165,250,0.15)'],
  Manifested: ['#71717A', 'rgba(113,113,122,0.15)'],
  Pending: ['#FBBF24', 'rgba(251,191,36,0.15)'],
  RTO: ['#94A3B8', 'rgba(148,163,184,0.15)'],
  'Due Today': ['#FBBF24', 'rgba(251,191,36,0.15)'],
}

function resolve(status) {
  if (status.startsWith('At Risk')) return ['#F87171', 'rgba(248,113,113,0.15)']
  return PILL[status] || null
}

export default function StatusPill({ status }) {
  if (status == null || status === '') return null

  const pair = resolve(status)
  // Unmapped (e.g. "On Track") → plain muted text, no pill.
  if (!pair) return <span style={{ color: '#71717A' }}>{status}</span>

  const [color, bg] = pair
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color,
        background: bg,
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  )
}
