/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        loteria: {
          red: '#C41E3A',
          green: '#006847',
          gold: '#F5C518',
          cream: '#FFF8E7',
          brown: '#8B4513',
        }
      },
      fontFamily: {
        display: ['Georgia', 'Times New Roman', 'serif'],
      },
      animation: {
        'card-draw': 'cardDraw 0.5s ease-out',
        'bounce-in': 'bounceIn 0.5s ease-out',
        'pulse-loteria': 'pulseLoteria 1s ease-in-out infinite',
      },
      keyframes: {
        cardDraw: {
          '0%': { transform: 'scale(0) rotate(-10deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseLoteria: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
      },
    },
  },
  plugins: [],
}
