/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef4ff',
          100: '#dce7ff',
          200: '#bed2ff',
          300: '#94b4ff',
          400: '#668ef4',
          500: '#466fce',
          600: '#3657ab',
          700: '#2d4689',
          800: '#273a70',
          900: '#21315d',
        },
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        softPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.82' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 420ms ease-out',
        'soft-pulse': 'softPulse 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
