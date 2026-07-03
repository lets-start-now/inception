/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      opacity: {
        12: '0.12',
        15: '0.15',
      },
      colors: {
        // Primary accent — refined blue. `brand` kept as an alias for continuity.
        accent: {
          50:  '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
        },
        brand: {
          50:  '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
        },
        // Neutral surface scale — light, premium (roles preserved from the
        // dark palette this replaced: 900=card, 950=page bg, 800=border,
        // 100=strongest text ... 600=most muted text).
        ink: {
          50:  '#ffffff', 100: '#0f1115', 200: '#1f2430', 300: '#3d4451',
          400: '#5b6472', 500: '#7c8592', 600: '#a1a8b3', 700: '#d8dce2',
          800: '#e8eaed', 850: '#f2f3f5', 900: '#ffffff', 950: '#f8f9fb',
        },
      },
      boxShadow: {
        soft:     '0 1px 2px rgba(15,23,42,0.06)',
        card:     '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.08)',
        elevated: '0 20px 25px -8px rgba(15,23,42,0.15), 0 8px 10px -6px rgba(15,23,42,0.08)',
        focus:    '0 0 0 3px rgba(59,130,246,0.25)',
      },
      animation: {
        'fade-in':  'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.32s cubic-bezier(0.16,1,0.3,1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1)',
        shimmer:    'shimmer 1.6s infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: 0, transform: 'scale(0.96)' }, to: { opacity: 1, transform: 'scale(1)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
    },
  },
  plugins: [],
}
