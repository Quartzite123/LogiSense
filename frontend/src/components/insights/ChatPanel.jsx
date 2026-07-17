import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '../../lib/useIsMobile.js'

// AI chat for the Insights page (INSIGHTS_SPEC §3.4). Self-contained: local
// conversation state, posts the full history to /api/assistant/chat, renders
// bubbles + suggestion chips + a welcome card.
// Desktop: inline panel at the bottom of the page.
// Mobile (≤768px): a floating 💬 button that opens a full-screen chat overlay.
const SUGGESTIONS = [
  'Which client is most at risk?',
  'Why is PRISM INDUSTRIES declining?',
  'How is ODA affecting our SLA?',
  'What improved this period?',
]

async function postChat(messages) {
  const res = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new Error(b.detail || `Chat failed (HTTP ${res.status})`)
  }
  return res.json()
}

function Bubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-[#FFD60A] text-black'
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
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const data = await postChat(next)
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${e.message}` }])
    } finally {
      setSending(false)
    }
  }

  const messagesContent =
    messages.length === 0 ? (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="text-3xl">✦</div>
        <h3 className="mt-3 text-base font-semibold text-[#F8F8F8]">How can I help?</h3>
        <p className="mt-1 max-w-sm text-sm text-[#71717A]">
          Ask about clients at risk, ODA lateness, growth, or what changed this period.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-[#27272A] bg-[#15151A] px-3.5 py-1.5 text-xs text-[#D4D4D8] transition-colors hover:border-[#FFD60A] hover:text-[#F8F8F8]"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-[#27272A] bg-[#15151A] px-4 py-3">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#71717A]"
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
          style={{ background: '#FFD60A' }}
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
          style={{ bottom: 68, right: 16, width: 48, height: 48, background: '#FFD60A', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
        >
          <span style={{ fontSize: 20 }}>💬</span>
        </button>

        {overlayOpen && (
          <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#0B0C0D' }}>
            <header className="flex items-center justify-between border-b border-[#27272A] px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="text-[#FFD60A]">✦</span>
                <h2 className="text-base font-semibold text-[#F8F8F8]">Ask the AI</h2>
              </div>
              <button
                onClick={() => setOverlayOpen(false)}
                aria-label="Close chat"
                className="text-2xl leading-none text-[#71717A] hover:text-[#F8F8F8]"
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
          <span className="text-[#FFD60A]">✦</span>
          <h2 className="text-[15px] font-semibold text-[#F8F8F8]">Ask the AI</h2>
        </div>
        <p className="mt-0.5 text-xs text-[#71717A]">Grounded in your current shipment data</p>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5" style={{ maxHeight: 460 }}>
        {messagesContent}
      </div>
      {inputBar}
    </div>
  )
}
