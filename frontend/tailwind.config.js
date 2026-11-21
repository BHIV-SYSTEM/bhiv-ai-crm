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
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        ink: {
          DEFAULT: '#181d26',
          body: '#333840',
          muted: '#41454d',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          active: '#0d1218',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
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
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          border: '#458fff',
          foreground: 'hsl(var(--info-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          border: '#39bf45',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
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
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'subtle': '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)',
        'card': '0 4px 12px rgba(0,0,0,0.04)',
        'elevated': '0 12px 32px rgba(0,0,0,0.08)',
        'glow-primary': '0 0 20px -5px rgba(24, 29, 38, 0.15)',
        'glow-secondary': '0 0 30px -5px hsl(var(--secondary) / 0.3)',
        'glow-accent': '0 0 30px -5px hsl(var(--accent) / 0.3)',
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
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-up': 'fade-up 0.4s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
