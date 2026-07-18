// Small shared helpers used by all section pages.
//
// In development VITE_API_URL is empty, so calls stay relative ("/api/...") and
// the Vite dev-server proxy forwards them to the backend on :8000. In production
// (Vercel) VITE_API_URL is the Render backend origin, so calls go straight there.
// Every API request — including the raw fetch() calls in ChatPanel/UploadModal —
// must be built with apiUrl().
const BASE = import.meta.env.VITE_API_URL || ''

export const apiUrl = (path) => `${BASE}${path}`

export async function fetchJSON(url) {
  // credentials: 'include' so the cross-origin logi_session cookie (Vercel → Render)
  // is sent and refreshed — this is what keeps each visitor on their own DB.
  const res = await fetch(apiUrl(url), { credentials: 'include' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `${url} → HTTP ${res.status}`)
  }
  return res.json()
}

// Trigger a browser download for a GET endpoint that returns an attachment.
export function download(url) {
  const a = document.createElement('a')
  a.href = apiUrl(url)
  document.body.appendChild(a)
  a.click()
  a.remove()
}
