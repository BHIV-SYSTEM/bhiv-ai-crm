/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'var(--hairline, #dddddd)',
        input: 'var(--hairline, #dddddd)',
        ring: '#181d26',
        background: '#ffffff',
        foreground: '#181d26',
        ink: {
          DEFAULT: '#181d26',
          body: '#333840',
          muted: '#41454d',
        },
        primary: {
          DEFAULT: '#181d26',
          active: '#0d1218',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#f8fafc',
          foreground: '#181d26',
        },
        signature: {
          coral: '#aa2d00',
          forest: '#0a2e0e',
          cream: '#f5e9d4',
          peach: '#fcab79',
          mint: '#a8d8c4',
          yellow: '#f4d35e',
          mustard: '#d9a441',
        },
        surface: {
          soft: '#f8fafc',
          strong: '#e0e2e6',
          dark: '#181d26',
          elevated: '#1d1f25',
        },
        accent: {
          DEFAULT: '#aa2d00',
          foreground: '#ffffff',
        },
        info: {
          DEFAULT: '#254fad',
          border: '#458fff',
          foreground: '#ffffff',
        },
        success: {
          DEFAULT: '#006400',
          border: '#39bf45',
          foreground: '#ffffff',
        },
        warning: {
          DEFAULT: '#d9a441',
          foreground: '#181d26',
        },
        destructive: {
          DEFAULT: '#aa2d00',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: '#f8fafc',
          foreground: '#41454d',
        },
        card: {
          DEFAULT: '#ffffff',
          foreground: '#181d26',
        },
      },
      fontFamily: {
        sans: ['Haas', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['Haas Groot Disp', 'Haas', 'Inter', 'sans-serif'],
        display: ['Haas Groot Disp', 'Inter Display', 'sans-serif'],
      },
      borderRadius: {
        xs: '2px',
        sm: '6px',
        md: '10px',
        lg: '12px',
        pill: '9999px',
        full: '9999px',
      },
      boxShadow: {
        'subtle': '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)',
        'card': '0 4px 12px rgba(0,0,0,0.04)',
        'elevated': '0 12px 32px rgba(0,0,0,0.08)',
        'glow-primary': '0 0 20px -5px rgba(24, 29, 38, 0.15)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-up': 'fade-up 0.4s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
