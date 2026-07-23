import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '../../lib/useIsMobile.js'
import { apiUrl } from '../../lib/api.js'
import { ChatIcon, SparkIcon } from '../icons.jsx'

// AI chat for the Insights page (INSIGHTS_SPEC §3.4). Self-contained: local
// conversation state, posts the full history to /api/assistant/chat, renders
// bubbles + suggestion chips + a welcome card.
// Desktop: inline panel at the bottom of the page.
// Mobile (≤768px): a floating chat button that opens a full-screen overlay.
const SUGGESTIONS = [
  'Which client is most at risk?',
  'Why is PRISM INDUSTRIES declining?',
  'How is ODA affecting our E+OT?',
  'What improved this period?',
]

// Reads the NDJSON stream ({"delta":"..."} per line) and hands each fragment to
// onDelta as it lands, so the reply types itself out instead of appearing at once.
async function streamChat(messages, onDelta) {
  const res = await fetch(apiUrl('/api/assistant/chat/stream'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ messages }),
  })
  if (!res.ok || !res.body) {
    const b = await res.json().catch(() => ({}))
    throw new Error(b.detail || `Chat failed (HTTP ${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    // Emit only complete lines; keep any partial tail for the next chunk.
    let nl
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      let obj
      try {
        obj = JSON.parse(line)
      } catch {
        continue
      }
      if (obj.delta) onDelta(obj.delta)
    }
  }
}

function Bubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-[#B18AFF] text-black'
            : 'rounded-bl-sm border border-[#27272A] bg-[#15151A] text-[#E4E4E7]'
        }`}
      >
        {content}
      </div>
    </div>
  )
}

export default function ChatPanel() {
  const isMobile = useIsMobile()
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, overlayOpen])

  async function send(text) {
    const content = (text ?? input).trim()
    if (!content || sending) return
    const next = [...messages, { role: 'user', content }]
    // Empty assistant bubble is the target the stream fills; it stays hidden
    // (and the typing dots stay up) until the first fragment arrives.
    setMessages([...next, { role: 'assistant', content: '' }])
    setInput('')
    setSending(true)
    try {
      await streamChat(next, (delta) => {
        setMessages((m) => {
          const copy = m.slice()
          const last = copy[copy.length - 1]
          copy[copy.length - 1] = { ...last, content: last.content + delta }
          return copy
        })
      })
    } catch (e) {
      setMessages((m) => {
        const copy = m.slice()
        copy[copy.length - 1] = { role: 'assistant', content: `⚠️ ${e.message}` }
        return copy
      })
    } finally {
      setSending(false)
    }
  }

  const messagesContent =
    messages.length === 0 ? (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <SparkIcon width="30" height="30" className="text-[#B18AFF]" />
        <h3 className="mt-3 text-base font-semibold text-[#F8F8F8]">How can I help?</h3>
        <p className="mt-1 max-w-sm text-sm text-[#8A8A93]">
          Ask about clients at risk, ODA lateness, growth, or what changed this period.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-[#27272A] bg-[#15151A] px-3.5 py-1.5 text-xs text-[#D4D4D8] transition-colors hover:border-[#B18AFF] hover:text-[#F8F8F8]"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        {/* The not-yet-filled placeholder is skipped so no empty bubble flashes. */}
        {messages.map((m, i) => (m.content ? <Bubble key={i} role={m.role} content={m.content} /> : null))}
        {sending && !messages[messages.length - 1]?.content && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-[#27272A] bg-[#15151A] px-4 py-3">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#8A8A93]"
                  style={{ animationDelay: `${d * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )

  const inputBar = (
    <div className="border-t border-[#27272A] p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={1}
          placeholder="Ask about your data…"
          className="max-h-32 flex-1 resize-none rounded-lg border border-[#27272A] bg-[#15151A] px-3.5 py-2.5 text-sm text-[#F8F8F8] placeholder:text-[#52525B] focus:border-[#3F3F46] focus:outline-none"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || sending}
          className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: '#B18AFF' }}
        >
          Send
        </button>
      </div>
    </div>
  )

  // --- Mobile: floating button + full-screen overlay ------------------------
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOverlayOpen(true)}
          aria-label="Open chat"
          className="fixed z-[55] flex items-center justify-center rounded-full"
          style={{ bottom: 68, right: 16, width: 48, height: 48, background: '#B18AFF', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
        >
          <ChatIcon width="22" height="22" className="text-black" />
        </button>

        {overlayOpen && (
          <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#0B0C0D' }}>
            <header className="flex items-center justify-between border-b border-[#27272A] px-5 py-4">
              <div className="flex items-center gap-2">
                <SparkIcon width="16" height="16" className="text-[#B18AFF]" />
                <h2 className="text-base font-semibold text-[#F8F8F8]">Ask the AI</h2>
              </div>
              <button
                onClick={() => setOverlayOpen(false)}
                aria-label="Close chat"
                className="text-2xl leading-none text-[#8A8A93] hover:text-[#F8F8F8]"
              >
                ×
              </button>
            </header>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
              {messagesContent}
            </div>
            {inputBar}
          </div>
        )}
      </>
    )
  }

  // --- Desktop: inline panel ------------------------------------------------
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#27272A] bg-[#0F0F11]" style={{ minHeight: 400 }}>
      <div className="border-b border-[#27272A] px-6 py-3.5">
        <div className="flex items-center gap-2">
          <SparkIcon width="16" height="16" className="text-[#B18AFF]" />
          <h2 className="text-[15px] font-semibold text-[#F8F8F8]">Ask the AI</h2>
        </div>
        <p className="mt-0.5 text-xs text-[#8A8A93]">Grounded in your current shipment data</p>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5" style={{ maxHeight: 460 }}>
        {messagesContent}
      </div>
      {inputBar}
    </div>
  )
}
