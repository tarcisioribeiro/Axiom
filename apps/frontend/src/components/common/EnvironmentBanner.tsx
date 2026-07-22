import { APP_ENV, IS_PRODUCTION } from '@/lib/app-info';

const ENV_CONFIG: Record<
  string,
  { label: string; bg: string; textColor: string; shadow: string }
> = {
  staging: {
    label: 'STAGING',
    bg: 'hsl(var(--warning))',
    textColor: 'hsl(var(--warning-foreground))',
    shadow: 'hsl(var(--warning) / 0.4)',
  },
  development: {
    label: 'DEV',
    bg: 'hsl(var(--info))',
    textColor: 'hsl(var(--info-foreground))',
    shadow: 'hsl(var(--info) / 0.4)',
  },
};

/**
 * Faixa diagonal estilo Flutter no canto superior direito.
 * Só renderiza em ambientes não-produção (VITE_APP_ENV !== "production").
 * position: fixed + pointer-events: none — não interfere com nenhum layout.
 */
export function EnvironmentBanner() {
  if (IS_PRODUCTION) return null;

  const config = ENV_CONFIG[APP_ENV] ?? ENV_CONFIG.development;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 100,
        height: 100,
        overflow: 'hidden',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 22,
          right: -28,
          width: 130,
          textAlign: 'center',
          background: config.bg,
          color: config.textColor,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.12em',
          padding: '4px 0',
          transform: 'rotate(45deg)',
          boxShadow: `0 2px 8px ${config.shadow}`,
          userSelect: 'none',
        }}
      >
        {config.label}
      </div>
    </div>
  );
}
