import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/src/**/*.{ts,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        surface: {
          base: '#0d1117',
          raised: '#161b27',
          overlay: '#1e2436'
        },
        border: '#2a3050',
        accent: {
          DEFAULT: '#c9a84c',
          hover: '#e0bc5c',
          muted: '#8a6f2e'
        },
        card: {
          npc: '#3b82f6',
          item: '#22c55e',
          location: '#f97316',
          lore: '#a855f7',
          faction: '#ef4444'
        }
      },
      fontFamily: {
        display: ['"Cinzel"', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config
