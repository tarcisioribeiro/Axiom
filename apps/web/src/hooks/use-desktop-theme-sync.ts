import { useEffect } from 'react';

import { API_CONFIG } from '@/config/api-config';
import {
  type DarkVariant,
  type LightVariant,
  isValidDarkVariant,
  isValidLightVariant,
} from '@/hooks/use-theme';
import { apiClient } from '@/services/api-client';

const POLL_INTERVAL_MS = 60_000;
// Último tema do desktop já aplicado: a escolha manual no ThemeToggle vale
// até o theme_switcher.sh do desktop trocar o tema de novo.
const LAST_SYNCED_KEY = 'desktopThemeSynced';

/**
 * Aplica o tema sincronizado do desktop (GET /me/theme/, gravado pelo
 * theme_switcher.sh via PUT /theme-sync/) sempre que ele mudar.
 * Só deve ser ativado em páginas autenticadas.
 */
export function useDesktopThemeSync(
  enabled: boolean,
  setDarkVariant: (variant: DarkVariant) => void,
  setLightVariant: (variant: LightVariant) => void
): void {
  useEffect(() => {
    if (!enabled) return;

    const sync = async () => {
      try {
        const { theme } = await apiClient.get<{ theme: string | null }>(
          API_CONFIG.ENDPOINTS.MY_THEME
        );
        if (!theme || localStorage.getItem(LAST_SYNCED_KEY) === theme) return;
        if (isValidDarkVariant(theme)) setDarkVariant(theme);
        else if (isValidLightVariant(theme)) setLightVariant(theme);
        else return;
        localStorage.setItem(LAST_SYNCED_KEY, theme);
      } catch {
        /* best-effort: sem sync, mantém o tema local */
      }
    };

    const run = () => void sync();
    run();
    const interval = window.setInterval(run, POLL_INTERVAL_MS);
    window.addEventListener('focus', run);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', run);
    };
    // setDarkVariant/setLightVariant mudam de identidade a cada troca de
    // variante; só re-agenda quando o sync é (des)ativado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
