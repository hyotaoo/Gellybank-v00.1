/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        ink: '#30292C',
        muted: '#9C9496',
        page: '#FCF4F7',
        cream: '#FFF2CA',
        gold: '#D4AF37',
        blush: '#FCE8EE',
        primary: {
          DEFAULT: '#D987A3',
          hover: '#BD5980',
        },
        rose: {
          300: '#F4A7BB',
          400: '#F6B8C8',
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
        // Figma 3:1386 — angular gradient centered at 91.5% 16.3%. The stop positions are
        // calibrated to the 688x295 card so the rendered midtones match Figma's render.
        'balance-gradient':
          'conic-gradient(from 302.5deg at 91.5% 16.3%, #FCE8EE 0%, #FAD5DF 8%, #F9CED9 67%, #F5AEC0 85.5%, #F4A7BB 91.5%, #FCE8EE 100%)',
      },
      boxShadow: {
        sidebar: '4px 0 20px 1px rgba(248, 219, 131, 0.25)',
        balance: '0 20px 40px rgba(217, 135, 163, 0.25)',
      },
    },
  },
  plugins: [],
};
