/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0e17',
        card: '#111827',
        'card-hover': '#1a2332',
        accent: '#00ff88',
        'accent-dim': '#00cc6a',
        secondary: '#38bdf8',
        danger: '#ef4444',
        warning: '#f59e0b',
        surface: '#1e293b',
        border: '#1e3a5f',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    }
  },
  plugins: []
}
