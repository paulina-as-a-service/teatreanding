/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme-aware tokens (defined in src/index.css)
        bg: token('bg'),
        surface: token('surface'),
        ink: token('ink'),
        text: token('text'),
        muted: token('muted'),
        accent: token('accent'),
        highlight: token('highlight'),
        line: token('line'),
        // Fixed brand palette
        brand: {
          white: '#ffffff',
          charcoal: '#454546',
          indigo: '#2e25a2',
          violet: '#5c4bd8',
          steel: '#6693af',
          mist: '#e4e0f1',
          lilac: '#d7c7ee',
          orchid: '#bf77d2',
          plum: '#8c2fa5',
          magenta: '#aa3277',
        },
      },
      fontFamily: {
        // Akzidenz-Grotesk is the brand font (commercial license). Archivo is the free fallback.
        sans: ['"Akzidenz-Grotesk"', '"Akzidenz-Grotesk Pro"', 'Archivo', 'system-ui', 'sans-serif'],
        display: ['"Saira Condensed"', 'Archivo', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        page: '78rem',
      },
    },
  },
  plugins: [],
};
