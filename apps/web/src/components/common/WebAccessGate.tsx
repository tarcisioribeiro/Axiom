import { Maximize2, Monitor, type LucideIcon } from 'lucide-react';
import React, { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { useTheme } from '@/hooks/use-theme';
import { useThemeAssets } from '@/hooks/use-theme-assets';
import {
  MIN_VIEWPORT_WIDTH,
  isMobileOrTabletDevice,
  useWebAccessStore,
} from '@/lib/web-access';

const WIDE_QUERY = `(min-width: ${MIN_VIEWPORT_WIDTH}px)`;

// matchMedia só dispara ao cruzar o limite (resize ou rotação), sem
// re-render a cada pixel redimensionado.
function subscribeWide(onChange: () => void) {
  const mql = window.matchMedia(WIDE_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}
const getWide = () => window.matchMedia(WIDE_QUERY).matches;

function BlockedScreen({ icon: Icon, scope }: { icon: LucideIcon; scope: string }) {
  const { t } = useTranslation();
  useTheme(); // aplica o tema salvo; o ThemeToggle do app não está montado
  const { logo } = useThemeAssets();
  return (
    // Sem rolagem em celular retrato (360×640 / 412×915 CSS px) e deitado
    // (640×360 / 915×412, duas colunas): dvh acompanha a barra de endereço;
    // logo (quadrado) limitado a 112 px
    <div
      role="alert"
      className="bg-muted/30 p-md animate-fade-in flex min-h-dvh items-center justify-center"
    >
      <Card className="gap-lg px-lg py-xl phone-landscape:max-w-2xl phone-landscape:flex-row phone-landscape:py-lg phone-landscape:text-left flex w-full max-w-md flex-col items-center text-center">
        <div className="gap-lg phone-landscape:gap-md phone-landscape:border-r phone-landscape:pr-lg flex shrink-0 flex-col items-center">
          <img
            src={logo}
            alt="Axiom"
            className="phone-landscape:h-20 phone-landscape:w-20 h-28 w-28"
          />
          <div className="bg-primary/10 text-primary ring-primary/20 phone-landscape:h-14 phone-landscape:w-14 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl ring-1 ring-inset">
            <Icon
              className="phone-landscape:h-7 phone-landscape:w-7 h-9 w-9"
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="space-y-sm">
          <h1 className="text-xl font-semibold text-balance">
            {t(`webAccess.${scope}.title`)}
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed text-pretty">
            {t(`webAccess.${scope}.message`)}
          </p>
        </div>
      </Card>
    </div>
  );
}

/**
 * Ponto único da política visual da versão Web: envolve o app inteiro
 * (login, rotas públicas e privadas). Dispositivo móvel tem prioridade sobre
 * janela estreita; esta só esconde o app até a largura mínima ser atingida.
 */
export function WebAccessGate({ children }: { children: React.ReactNode }) {
  const [isMobile] = useState(() => isMobileOrTabletDevice());
  const serverBlocked = useWebAccessStore((s) => s.serverBlocked);
  const isWide = useSyncExternalStore(subscribeWide, getWide);

  if (isMobile || serverBlocked) return <BlockedScreen icon={Monitor} scope="device" />;
  if (!isWide) return <BlockedScreen icon={Maximize2} scope="smallWindow" />;
  return <>{children}</>;
}
