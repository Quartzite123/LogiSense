import { useEffect, useState } from 'react'

// Single source of truth for the mobile breakpoint (matches the max-width:768px
// media query in index.css). Used by MobileNav, DigestCard, and ChatPanel so the
// JS-driven and CSS-driven mobile behaviour flip at exactly the same width.
const QUERY = '(max-width: 768px)'

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = (e) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
