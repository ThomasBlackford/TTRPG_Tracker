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
        },
        // Every "accent" highlight in this app (buttons, active nav, links,
        // focus rings) consistently uses these four amber shades — so
        // overriding just them lets the whole app re-theme via the
        // Settings panel with no component changes. amber-700/100 (the
        // fixed "Prone" condition badge) is deliberately left untouched.
        //
        // rgb(var(--x) / <alpha-value>) is Tailwind's documented pattern
        // for CSS-variable colors — it's what keeps opacity modifiers like
        // amber-500/20 working. The variables hold space-separated RGB
        // channels (not hex), which is what that syntax requires.
        amber: {
          200: 'rgb(var(--color-accent-200) / <alpha-value>)',
          300: 'rgb(var(--color-accent-300) / <alpha-value>)',
          400: 'rgb(var(--color-accent-400) / <alpha-value>)',
          500: 'rgb(var(--color-accent-500) / <alpha-value>)'
        }
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif']
      },
      // Same trick as the color override — rounded-xl/rounded-lg are used
      // throughout for cards/buttons/inputs, so wiring the scale itself to
      // a variable makes the "Style" setting affect the whole app.
      borderRadius: {
        xl: 'var(--radius-card, 0.75rem)',
        lg: 'var(--radius-input, 0.5rem)'
      }
    }
  },
  plugins: []
} satisfies Config
