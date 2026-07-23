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
  hero = false,
  className = '',
}) {
  const [hover, setHover] = useState(false)
  const bar = Math.max(0, Math.min(100, Number(barPercent) || 0))

  // The hero card carries the headline metric: tinted surface, brand-tinted
  // border and a resting glow so it outranks the surrounding tiles at a glance.
  const restBorder = hero ? 'rgba(177, 138, 255,0.30)' : '#27272A'
  const restShadow = hero ? '0 0 24px rgba(177, 138, 255,0.07)' : 'none'

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={className}
      style={{
        background: hero
          ? 'linear-gradient(160deg, rgba(177, 138, 255,0.06) 0%, rgba(177, 138, 255,0.015) 45%, #0F0F11 100%)'
          : '#0F0F11',
        border: `1px solid ${hover ? '#B18AFF' : restBorder}`,
        borderRadius: 12,
        padding: hero ? 22 : 18,
        height: '100%',
        boxShadow: hover ? '0 0 12px rgba(177, 138, 255,0.15)' : restShadow,
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
          color: hero ? '#A1A1AA' : '#8A8A93',
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
            marginTop: hero ? 10 : 6,
            fontSize: hero ? 46 : 32,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: hero ? '-0.01em' : undefined,
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
        <div style={{ marginTop: showBar ? 0 : 8, fontSize: 12, color: '#8A8A93' }}>
          {subtext}
        </div>
      )}
    </div>
  )
}
