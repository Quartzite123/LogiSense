import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Demo gate: no backend auth. Hardcoded credentials, localStorage flag.
const DEMO_EMAIL = 'demo@logisense.app'
const DEMO_PASSWORD = 'demo1234'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  function submit(e) {
    e.preventDefault()
    if (email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      localStorage.setItem('logi_auth', 'true')
      navigate('/', { replace: true })
    } else {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  const fill = () => {
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
    setError(false)
  }

  // focus:outline-none is paired with a visible ring, never left bare.
  const inputBase =
    'w-full rounded-lg border bg-[#15151A] px-4 py-3 text-sm text-[#F8F8F8] placeholder:text-[#52525B] ' +
    'transition-colors focus:outline-none focus:ring-2 focus:ring-[#B18AFF]/50'
  const inputBorder = error
    ? 'border-[#F87171] focus:border-[#F87171]'
    : 'border-[#27272A] focus:border-[#3F3F46]'

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0B0C0D] p-4">
      {/* Ambient brand glow: lifts the card off an otherwise flat background. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          width: 620,
          height: 620,
          background:
            'radial-gradient(circle, rgba(177, 138, 255,0.10) 0%, rgba(177, 138, 255,0.035) 40%, transparent 70%)',
        }}
      />

      {/* Entrance lives on the wrapper so it cannot fight the shake on the card. */}
      <div className="ls-rise relative w-full max-w-[400px]">
        <div
          className={`rounded-2xl border border-[#27272A] bg-[#0F0F11] ${shake ? 'login-shake' : ''}`}
          style={{ padding: 40, boxShadow: '0 24px 60px -20px rgba(0,0,0,0.85)' }}
        >
          {/* Brand */}
          <div className="mb-8 text-center">
            <div className="font-mono text-2xl font-bold tracking-tight text-[#B18AFF]">LogiSense</div>
            <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.22em] text-[#8A8A93]">
              Logistics · Intelligence
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-[#F8F8F8]">Welcome back</h1>
          <p className="mt-1 text-sm text-[#8A8A93]">Sign in to your dashboard</p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(false)
              }}
              placeholder="Email address"
              autoComplete="username"
              className={`${inputBase} ${inputBorder}`}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(false)
              }}
              placeholder="Password"
              autoComplete="current-password"
              className={`${inputBase} ${inputBorder}`}
            />

            {error && <p className="text-sm text-[#F87171]">Invalid credentials</p>}

            {/* Demo credentials hint */}
            <div
              className="rounded-lg"
              style={{
                background: 'rgba(177, 138, 255, 0.06)',
                border: '1px solid rgba(177, 138, 255, 0.2)',
                padding: '12px 16px',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-[#A1A1AA]">Demo access, use these credentials:</span>
                <button
                  type="button"
                  onClick={fill}
                  className="ls-focus shrink-0 rounded-md border border-[#B18AFF]/40 px-2 py-1 text-[11px] font-medium text-[#B18AFF] transition-colors hover:bg-[#B18AFF]/10"
                >
                  Click to fill
                </button>
              </div>
              <div className="mt-2 space-y-0.5 font-mono text-xs text-[#B18AFF]">
                <div>{DEMO_EMAIL}</div>
                <div>{DEMO_PASSWORD}</div>
              </div>
            </div>

            <button
              type="submit"
              className="ls-focus mt-1 w-full rounded-lg py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              style={{ background: '#B18AFF' }}
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
