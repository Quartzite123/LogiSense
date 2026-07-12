/** @type {import('tailwindcss').Config} */
// Color values are the locked design system (mirrored in src/styles/tokens.js
// for JS/Recharts consumers). Keep the two in sync.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        surface: '#0F0F11',
        surface2: '#15151A',
        primary: '#FFD60A',
        'text-primary': '#F8F8F8',
        'text-muted': '#71717A',
        early: '#4ADE80',
        ontime: '#60A5FA',
        late: '#F87171',
        rto: '#94A3B8',
        border: '#27272A',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
