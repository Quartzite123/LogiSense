import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server on :5173. /api is proxied to the FastAPI backend on :8000 so the
// browser makes same-origin requests (no CORS needed in dev; the backend also
// enables CORS for :5173 as a backstop).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Use 127.0.0.1 (not localhost): on Windows + Node >=17, `localhost`
        // can resolve to IPv6 ::1 first, while uvicorn binds IPv4 127.0.0.1 —
        // causing the proxy to ECONNREFUSED even though curl works.
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
