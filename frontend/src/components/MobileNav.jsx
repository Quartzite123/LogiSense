import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useIsMobile } from '../lib/useIsMobile.js'

// Bottom navigation bar shown only at ≤768px (the desktop sidebar is hidden there).
// 3 primary destinations + a Menu that slides up a drawer with the rest.
const PRIMARY = [
  { to: '/', label: 'Landing', icon: '🏠', end: true },
  { to: '/insights', label: 'Insights', icon: '✦' },
  { to: '/transit', label: 'Transit', icon: '📦' },
]
const DRAWER = [
  { to: '/tat', label: 'TAT Analysis' },
  { to: '/aggregate', label: 'Aggregate' },
  { to: '/aggregate-transit', label: 'Aggregate Transit' },
  { to: '/customize', label: 'Customize' },
  { to: '/edit', label: 'Edit' },
]
const ACTIVE = '#FFD60A'
const IDLE = '#71717A'

function BarItem({ to, label, icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className="flex flex-1 flex-col items-center justify-center gap-0.5"
      style={({ isActive }) => ({ color: isActive ? ACTIVE : IDLE })}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 10 }}>{label}</span>
    </NavLink>
  )
}

export default function MobileNav() {
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname } = useLocation()

  if (!isMobile) return null

  const menuActive = DRAWER.some((d) => d.to === pathname)
  const close = () => setDrawerOpen(false)

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex items-stretch justify-around border-t border-[#27272A] bg-[#0F0F11]"
        style={{ minHeight: 56, paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {PRIMARY.map((item) => (
          <BarItem key={item.to} {...item} />
        ))}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5"
          style={{ color: menuActive ? ACTIVE : IDLE }}
          aria-label="More sections"
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>☰</span>
          <span style={{ fontSize: 10 }}>Menu</span>
        </button>
      </nav>

      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-[55] bg-black/60" onClick={close} />
          <div
            className="fixed inset-x-0 bottom-0 z-[56] border-t border-[#27272A] bg-[#0F0F11]"
            style={{
              borderRadius: '16px 16px 0 0',
              padding: 20,
              paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
            }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#3F3F46]" />
            <div className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#71717A]">
              More sections
            </div>
            <div className="flex flex-col gap-1">
              {DRAWER.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={close}
                  className="rounded-lg border border-[#27272A] bg-[#15151A] px-4 py-3 text-sm text-[#F8F8F8]"
                  style={({ isActive }) => ({
                    borderColor: isActive ? ACTIVE : '#27272A',
                    color: isActive ? ACTIVE : '#F8F8F8',
                  })}
                >
                  {label}
                </NavLink>
              ))}
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('logi_auth')
                window.location.href = '/login'
              }}
              style={{
                width: '100%',
                padding: '14px 16px',
                textAlign: 'left',
                color: '#F87171',
                background: 'none',
                border: 'none',
                fontSize: '15px',
                cursor: 'pointer',
                borderTop: '1px solid #27272A',
                marginTop: '8px',
                paddingTop: '16px',
              }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </>
  )
}
