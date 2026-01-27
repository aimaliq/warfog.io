/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lime: {
          50:  '#edfff4',
          100: '#d5ffe6',
          200: '#aeffd0',
          300: '#71f5a9',
          400: '#33e67d',
          500: '#21bd5a',
          600: '#1a9a49',
          700: '#16793c',
          800: '#165f33',
          900: '#144e2c',
          950: '#052b15',
        },
        terminal: {
          bg: '#000000',
          green: '#a3e635',
          red: '#ef4444',
          gray: '#6b7280',
          yellow: '#fbbf24',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'missile-launch': 'missile-launch 2s ease-out forwards',
        'missile-impact': 'missile-impact 0.5s ease-out forwards',
        'hp-drain': 'hp-drain 0.8s ease-out forwards',
        'pulse-glow': 'pulse-glow 1s ease-in-out infinite',
        'spin-slow': 'spin 10s linear infinite',
        'spin-pulse': 'spin-pulse 3s ease-in-out infinite',
      },
      keyframes: {
        'spin-pulse': {
          '0%, 100%': { transform: 'rotate(0deg) scale(1)' },
          '25%': { transform: 'rotate(90deg) scale(1.1)' },
          '50%': { transform: 'rotate(180deg) scale(1)' },
          '75%': { transform: 'rotate(270deg) scale(1.1)' },
        },
      },
    },
  },
  plugins: [],
};