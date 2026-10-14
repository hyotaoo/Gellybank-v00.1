/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        ink: '#30292C',
        muted: '#9C9496',
        primary: {
          DEFAULT: '#D987A3',
          hover: '#BD5980',
        },
        surface: {
          card: '#FCF1F5',
          input: '#F8E7B9',
          soft: '#FCF5E3',
          line: '#F2ECE7',
        },
        disabled: {
          bg: '#F0E8EB',
          fg: '#9C9496',
        },
        brand: {
          from: '#E79AB4',
          via: '#DC8FA9',
          to: '#E6B0C2',
          accent: '#F6C2D5',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #E79AB4 0%, #DC8FA9 50%, #E6B0C2 100%)',
      },
    },
  },
  plugins: [],
};
