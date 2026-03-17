/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        ink:    '#1c1917',
        'ink-2': '#44403c',
        'ink-3': '#78716c',
        surface: '#faf8f4',
        bg:     '#f4efe6',
        'bg-2': '#ece6d9',
        border: '#d6cfc3',
        cfg:    '#16a34a',
        pda:    '#ea580c',
        tm:     '#e11d48',
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        'ink':    '3px 3px 0 #d6cfc3',
        'ink-md': '4px 4px 0 #44403c',
        'ink-sm': '2px 2px 0 #d6cfc3',
      },
      animation: {
        'shake':  'shake 0.5s ease-in-out',
        'pop-in': 'pop-in 0.35s ease-out forwards',
        'fade-in':'fadeIn 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
