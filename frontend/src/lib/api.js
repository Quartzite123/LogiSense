// Small shared helpers used by all section pages.

export async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `${url} → HTTP ${res.status}`)
  }
  return res.json()
}

// Trigger a browser download for a GET endpoint that returns an attachment.
export function download(url) {
  const a = document.createElement('a')
  a.href = url
  document.body.appendChild(a)
  a.click()
  a.remove()
}
