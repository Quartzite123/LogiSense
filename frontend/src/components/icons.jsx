// Inline SVG icons (no icon library, built from scratch per spec).
// Extracted from Sidebar so the mobile nav, chat and modals share one icon set
// instead of falling back to emoji.
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

export const GridIcon = ico(
  <>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </>,
)
export const ClockIcon = ico(
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5V8l2.5 2" />
  </>,
)
export const TruckIcon = ico(
  <>
    <path d="M2 11h9V4H2zM11 7h2.5l1.5 2v2h-4" />
    <circle cx="5" cy="13" r="1.3" />
    <circle cx="12" cy="13" r="1.3" />
  </>,
)
export const BarsIcon = ico(<path d="M2 14V9M6 14V3M10 14V7M14 14V5" />)
export const SlidersIcon = ico(
  <>
    <path d="M3 4h10M5 8h6M7 12h2" />
  </>,
)
export const SparkIcon = ico(
  <path d="M8 2l1.4 3.6L13 7l-3.6 1.4L8 12l-1.4-3.6L3 7l3.6-1.4z" />,
)
export const PencilIcon = ico(<path d="M3 13l3-1L13 5l-2-2-7 7-1 3z" />)
export const ChevronIcon = ico(<path d="M10 4l-4 4 4 4" />)
export const LogoutIcon = ico(
  <>
    <path d="M6 14H3V2h3" />
    <path d="M10 11l3-3-3-3M13 8H6" />
  </>,
)

// --- added so no surface has to fall back to an emoji -----------------------
export const MenuIcon = ico(<path d="M2 4h12M2 8h12M2 12h12" />)
export const ChatIcon = ico(
  <path d="M14 10a2 2 0 0 1-2 2H6l-3.5 2.5V4a2 2 0 0 1 2-2h7.5a2 2 0 0 1 2 2z" />,
)
export const CheckIcon = ico(
  <>
    <circle cx="8" cy="8" r="6.2" />
    <path d="M5.2 8.2l2 2 3.6-4" />
  </>,
)
