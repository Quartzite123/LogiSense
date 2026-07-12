import { useState } from 'react'

// KPI tile built to an exact spec (precise px + dynamic per-card colors), so
// styling is inline. Hover (translateY + yellow border/glow) is driven by state
// because inline styles can't express :hover. Every card behaves identically.
export default function KPICard({
  label,
  value,
  valueColor = '#F8F8F8',
  subtext,
  showBar = false,
  barPercent = 0,
  isDateCard = false,
}) {
  const [hover, setHover] = useState(false)
  const bar = Math.max(0, Math.min(100, Number(barPercent) || 0))

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#0F0F11',
        border: `1px solid ${hover ? '#FFD60A' : '#27272A'}`,
        borderRadius: 12,
        padding: 18,
        boxShadow: hover ? '0 0 12px rgba(255,214,10,0.15)' : 'none',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        transition:
          'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#71717A',
        }}
      >
        {label}
      </div>

      {isDateCard ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 15,
            fontWeight: 400,
            color: '#FFFFFF',
            fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
          }}
        >
          {value}
        </div>
      ) : (
        <div
          style={{
            marginTop: 6,
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1.1,
            color: valueColor,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          }}
        >
          {value}
        </div>
      )}

      {showBar && (
        <div
          style={{
            height: 4,
            margin: '8px 0',
            background: '#27272A',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${bar}%`,
              background: valueColor,
              borderRadius: 2,
            }}
          />
        </div>
      )}

      {subtext != null && (
        <div style={{ marginTop: showBar ? 0 : 8, fontSize: 12, color: '#71717A' }}>
          {subtext}
        </div>
      )}
    </div>
  )
}
