import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Demo gate — no backend auth. Hardcoded credentials, localStorage flag.
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

  const inputBase =
    'w-full rounded-lg border bg-[#15151A] px-4 py-3 text-sm text-[#F8F8F8] placeholder:text-[#52525B] focus:outline-none'
  const inputBorder = error
    ? 'border-[#F87171] focus:border-[#F87171]'
    : 'border-[#27272A] focus:border-[#3F3F46]'

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#0B0C0D] p-4">
      <div
        className={`w-full max-w-[400px] rounded-2xl border border-[#27272A] bg-[#0F0F11] ${shake ? 'login-shake' : ''}`}
        style={{ padding: 40 }}
      >
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="font-mono text-2xl font-bold tracking-tight text-[#FFD60A]">LogiSense</div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.22em] text-[#71717A]">
            Logistics · Intelligence
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-[#F8F8F8]">Welcome back</h1>
        <p className="mt-1 text-sm text-[#71717A]">Sign in to your dashboard</p>

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
              background: 'rgba(255,214,10,0.06)',
              border: '1px solid rgba(255,214,10,0.2)',
              padding: '12px 16px',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#A1A1AA]">Demo access — use these credentials:</span>
              <button
                type="button"
                onClick={fill}
                className="shrink-0 rounded-md border border-[#FFD60A]/40 px-2 py-1 text-[11px] font-medium text-[#FFD60A] hover:bg-[#FFD60A]/10"
              >
                Click to fill
              </button>
            </div>
            <div className="mt-2 space-y-0.5 font-mono text-xs text-[#FFD60A]">
              <div>{DEMO_EMAIL}</div>
              <div>{DEMO_PASSWORD}</div>
            </div>
          </div>

          <button
            type="submit"
            className="mt-1 w-full rounded-lg py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            style={{ background: '#FFD60A' }}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}
