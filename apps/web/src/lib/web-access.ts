import { create } from 'zustand';

/**
 * Política de acesso da versão Web: só PCs/notebooks.
 *
 * Detecção por sinais do navegador (falsificáveis) — é política de UX, não
 * segurança. O backend aplica a mesma regra ao login e à sessão por cookie
 * (apps/api/authentication/device_policy.py) e responde 403 com
 * `code: "web_device_not_allowed"`.
 */

/**
 * Largura mínima da viewport. 1280 = breakpoint `xl`: abaixo disso a
 * sidebar (256 px) deixa < 1024 px de conteúdo com as grades `lg:` ainda
 * ativas (4 colunas, calendário `1fr + 20rem`), que ficam espremidas.
 */
export const MIN_VIEWPORT_WIDTH = 1280;

export const WEB_DEVICE_BLOCK_CODE = 'web_device_not_allowed';

// Mesma lista do backend
const MOBILE_UA =
  /Mobi|Android|iPhone|iPad|iPod|Tablet|Silk|Kindle|PlayBook|BlackBerry|IEMobile|Opera Mini|webOS/i;

type NavigatorLike = Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & {
  userAgentData?: { mobile?: boolean };
};

export function isMobileOrTabletDevice(
  nav: NavigatorLike = navigator,
  matchMedia: (q: string) => { matches: boolean } = window.matchMedia.bind(window)
): boolean {
  if (nav.userAgentData?.mobile) return true;
  if (MOBILE_UA.test(nav.userAgent)) return true;
  // iPadOS 13+ se apresenta como Mac; Mac de verdade não tem touch
  if (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1) return true;
  // Tablet Android em "modo desktop" (UA Linux): só toque, nenhum ponteiro
  // fino. Notebook com touchscreen tem mouse/touchpad (`any-pointer: fine`).
  return (
    matchMedia('(pointer: coarse)').matches &&
    !matchMedia('(any-pointer: fine)').matches
  );
}

/** Ligado pelo api-client quando o backend bloqueia o dispositivo. */
export const useWebAccessStore = create<{ serverBlocked: boolean }>(() => ({
  serverBlocked: false,
}));

export function isWebDeviceBlockResponse(status?: number, data?: unknown): boolean {
  return (
    status === 403 &&
    (data as { code?: unknown } | undefined)?.code === WEB_DEVICE_BLOCK_CODE
  );
}
