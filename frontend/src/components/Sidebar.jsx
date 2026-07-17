import { useState } from 'react'
import { NavLink } from 'react-router-dom'

// Inline SVG icons (no icon library — built from scratch per spec).
const ico = (paths) => (props) =>
  (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths}
    </svg>
  )

const GridIcon = ico(
  <>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </>,
)
const ClockIcon = ico(
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5V8l2.5 2" />
  </>,
)
const TruckIcon = ico(
  <>
    <path d="M2 11h9V4H2zM11 7h2.5l1.5 2v2h-4" />
    <circle cx="5" cy="13" r="1.3" />
    <circle cx="12" cy="13" r="1.3" />
  </>,
)
const BarsIcon = ico(<path d="M2 14V9M6 14V3M10 14V7M14 14V5" />)
const SlidersIcon = ico(
  <>
    <path d="M3 4h10M5 8h6M7 12h2" />
  </>,
)
const SparkIcon = ico(
  <path d="M8 2l1.4 3.6L13 7l-3.6 1.4L8 12l-1.4-3.6L3 7l3.6-1.4z" />,
)
const PencilIcon = ico(<path d="M3 13l3-1L13 5l-2-2-7 7-1 3z" />)
const ChevronIcon = ico(<path d="M10 4l-4 4 4 4" />)

const NAV = [
  { to: '/', label: 'Landing', sub: 'Overview', Icon: GridIcon, end: true },
  { to: '/tat', label: 'TAT Analysis', sub: 'Delivered E+OT', Icon: ClockIcon },
  { to: '/transit', label: 'Transit', sub: 'In-flight', Icon: TruckIcon },
  { to: '/aggregate', label: 'Aggregate', sub: 'Company breakdown', Icon: BarsIcon },
  {
    to: '/aggregate-transit',
    label: 'Aggregate Transit',
    sub: 'Per-company in-flight',
    Icon: TruckIcon,
  },
  { to: '/customize', label: 'Customize', sub: 'Ad-hoc query', Icon: SlidersIcon },
  { to: '/edit', label: 'Edit', sub: 'Reference data', Icon: PencilIcon },
  { to: '/insights', label: 'AI Insights', sub: 'Patterns · Chat', Icon: SparkIcon },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`sidebar-desktop flex h-full shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200 ${
        collapsed ? 'w-[64px]' : 'w-[240px]'
      }`}
    >
      {/* Brand + collapse toggle */}
      <div className="flex items-center justify-between px-4 py-5">
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-lg font-semibold tracking-tight text-primary">
              LogiSense
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
              Logistics · Intelligence
            </span>
          </div>
        )}
        {collapsed && (
          <span className="mx-auto font-mono text-lg font-bold text-primary">LS</span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="rounded-md p-1.5 text-text-muted hover:bg-surface hover:text-text-primary"
        >
          <ChevronIcon
            className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="px-5 pb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted">
          Workspace
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2">
        {NAV.map(({ to, label, sub, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-md px-3 py-2 transition-colors',
                collapsed ? 'justify-center' : '',
                isActive
                  ? 'text-text-primary'
                  : 'text-text-muted hover:bg-surface hover:text-text-primary',
              ].join(' ')
            }
            style={({ isActive }) => ({
              borderLeft: isActive ? '3px solid #FFD60A' : '3px solid transparent',
              background: isActive ? 'rgba(255,214,10,0.06)' : undefined,
            })}
          >
            <span className="shrink-0">
              <Icon />
            </span>
            {!collapsed && (
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-[11px] text-text-muted">{sub}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-early" />
          {!collapsed && <span>Local · Offline-ready</span>}
        </div>
      </div>
    </aside>
  )
}
