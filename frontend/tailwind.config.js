/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'] },
      colors: {
        paper: '#F4F6F4',
        ink: '#12201C',
        brand: { 50: '#E8F5F2', 100: '#CDEBE4', 500: '#12907F', 600: '#0E7C6E', 700: '#0B6458' },
      },
    },
  },
  plugins: [],
};
