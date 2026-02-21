/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          'Fira Sans',
          'Droid Sans',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        star: 'hsl(var(--star))',
        category: {
          finance: 'hsl(var(--category-finance))',
          health: 'hsl(var(--category-health))',
          studies: 'hsl(var(--category-studies))',
          spiritual: 'hsl(var(--category-spiritual))',
          exercise: 'hsl(var(--category-exercise))',
          nutrition: 'hsl(var(--category-nutrition))',
          work: 'hsl(var(--category-work))',
          leisure: 'hsl(var(--category-leisure))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'dialog-overlay-show': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'dialog-overlay-hide': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'dialog-content-show': {
          from: {
            opacity: '0',
            transform: 'translate(-50%, -45%) scale(0.92)',
          },
          to: {
            opacity: '1',
            transform: 'translate(-50%, -50%) scale(1)',
          },
        },
        'dialog-content-hide': {
          from: {
            opacity: '1',
            transform: 'translate(-50%, -50%) scale(1)',
          },
          to: {
            opacity: '0',
            transform: 'translate(-50%, -47%) scale(0.94)',
          },
        },
        'slide-up-fade': {
          from: {
            opacity: '0',
            transform: 'translate(-50%, -45%) scale(0.95)',
          },
          to: {
            opacity: '1',
            transform: 'translate(-50%, -50%) scale(1)',
          },
        },
        'slide-down-fade': {
          from: {
            opacity: '0',
            transform: 'translate(-50%, -55%) scale(0.95)',
          },
          to: {
            opacity: '1',
            transform: 'translate(-50%, -50%) scale(1)',
          },
        },
        'bounce-in': {
          '0%': {
            opacity: '0',
            transform: 'translate(-50%, -50%) scale(0.3)',
          },
          '50%': {
            transform: 'translate(-50%, -50%) scale(1.05)',
          },
          '70%': {
            transform: 'translate(-50%, -50%) scale(0.9)',
          },
          '100%': {
            opacity: '1',
            transform: 'translate(-50%, -50%) scale(1)',
          },
        },
        'shake': {
          '0%, 100%': { transform: 'translate(-50%, -50%) translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translate(-50%, -50%) translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translate(-50%, -50%) translateX(4px)' },
        },
      },
      animation: {
        'dialog-overlay-show': 'dialog-overlay-show 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'dialog-overlay-hide': 'dialog-overlay-hide 180ms cubic-bezier(0.4, 0, 0.2, 1)',
        'dialog-content-show': 'dialog-content-show 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'dialog-content-hide': 'dialog-content-hide 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-up-fade': 'slide-up-fade 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down-fade': 'slide-down-fade 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce-in': 'bounce-in 400ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'shake': 'shake 400ms cubic-bezier(0.36, 0.07, 0.19, 0.97)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        spring: 'var(--ease-spring)',
      },
      backdropBlur: {
        xs: '2px',
      },
      fontSize: {
        xs: ['var(--text-xs)', { lineHeight: 'var(--leading-xs)' }],
        sm: ['var(--text-sm)', { lineHeight: 'var(--leading-sm)' }],
        base: ['var(--text-base)', { lineHeight: 'var(--leading-base)' }],
        lg: ['var(--text-lg)', { lineHeight: 'var(--leading-lg)' }],
        xl: ['var(--text-xl)', { lineHeight: 'var(--leading-xl)' }],
        '2xl': ['var(--text-2xl)', { lineHeight: 'var(--leading-2xl)' }],
      },
      fontWeight: {
        normal: 'var(--font-normal)',
        medium: 'var(--font-medium)',
        semibold: 'var(--font-semibold)',
        bold: 'var(--font-bold)',
      },
      spacing: {
        xs: 'var(--spacing-xs)',
        sm: 'var(--spacing-sm)',
        md: 'var(--spacing-md)',
        lg: 'var(--spacing-lg)',
        xl: 'var(--spacing-xl)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
