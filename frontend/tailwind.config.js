/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#090d16',
        },
        water: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        foam: {
          50: '#f4fbfc',
          100: '#e7f7fa',
          200: '#c5eef4',
          300: '#91e0ec',
          400: '#54cbdf',
          500: '#0891b2',
        },
      },
      fontFamily: {
        sans: [
          'Plus Jakarta Sans',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        card: '0 4px 20px -2px rgba(12, 74, 110, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
        hover: '0 10px 25px -3px rgba(14, 165, 233, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        glass: '0 8px 32px 0 rgba(14, 165, 233, 0.08)',
      },
    },
  },
  plugins: [],
};
