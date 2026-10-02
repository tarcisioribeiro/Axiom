/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        /* Body text — SF Pro Text on macOS, Segoe UI on Windows, system-ui elsewhere */
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Segoe UI',
          'Helvetica Neue',
          'sans-serif',
        ],
        /* Display / headings — SF Pro Rounded on macOS 11+, Segoe UI on Windows */
        display: [
          'ui-rounded',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'system-ui',
          'Helvetica Neue',
          'sans-serif',
        ],
        /* Monospace — SF Mono on macOS, Cascadia Code on Windows 11, JetBrains Mono fallback */
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'SF Mono',
          'Cascadia Code',
          'Cascadia Mono',
          'JetBrains Mono',
          'Consolas',
          'Liberation Mono',
          'monospace',
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
          intellect: 'hsl(var(--category-intellect))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      // Padrão global: só opacity/transform (compositor), deltas relativos ao
      // estado final — não repetem o translate de centralização do elemento.
      keyframes: {
        'fade-in': { from: { opacity: '0' } },
        'fade-out': { to: { opacity: '0' } },
        'pop-in': { from: { opacity: '0', transform: 'scale(0.95)' } },
        'pop-out': { to: { opacity: '0', transform: 'scale(0.95)' } },
        shake: {
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in var(--duration-normal) var(--ease-out)',
        'fade-out': 'fade-out var(--duration-fast) ease-in forwards',
        'pop-in': 'pop-in var(--duration-normal) var(--ease-out)',
        'pop-out': 'pop-out var(--duration-fast) ease-in forwards',
        shake: 'shake 400ms cubic-bezier(0.36, 0.07, 0.19, 0.97)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        medium: 'var(--duration-medium)',
        slow: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        spring: 'var(--ease-spring)',
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
      },
      backdropBlur: {
        xs: '2px',
      },
      fontSize: {
        '2xs': ['var(--text-2xs)', { lineHeight: 'var(--leading-2xs)' }],
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
      zIndex: {
        header: '30',
        'sidebar-overlay': '40',
        sidebar: '50',
        modal: '60',
        toast: '100',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    // `hoverable:` — @media (hover: hover) and (pointer: fine), para gatear
    // hover:scale/translate/etc. em telas de toque (onde :hover "gruda" após
    // o tap). Uso: hoverable:hover:-translate-y-px em vez de hover:-translate-y-px.
    function ({ addVariant }) {
      addVariant('hoverable', '@media (hover: hover) and (pointer: fine)');
    },
  ],
}
