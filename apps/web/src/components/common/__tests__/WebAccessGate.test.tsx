/**
 * Política visual da versão Web. A detecção usa sinais declarados pelo
 * navegador (UA, Client Hints, maxTouchPoints, pointer) — os testes provam a
 * reação a esses sinais, não que eles sejam verdadeiros. Quem garante o
 * bloqueio de fato é o backend (tests/test_web_device_policy.py).
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ptBR from '@/i18n/locales/pt-BR.json';
import {
  MIN_VIEWPORT_WIDTH,
  isMobileOrTabletDevice,
  isWebDeviceBlockResponse,
  useWebAccessStore,
} from '@/lib/web-access';

import { WebAccessGate } from '../WebAccessGate';

const UA = {
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  linuxDesktop:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
};

// Mídia controlável: largura, ponteiro e listeners de `change`
let width = 1920;
let coarseOnly = false;
const listeners = new Map<(e: { matches: boolean }) => void, string>();

function evaluate(query: string): boolean {
  const min = /min-width:\s*(\d+)px/.exec(query);
  if (min) return width >= Number(min[1]);
  if (query.includes('pointer: coarse')) return coarseOnly;
  if (query.includes('any-pointer: fine')) return !coarseOnly;
  return false;
}

const fakeMatchMedia = (query: string) =>
  ({
    get matches() {
      return evaluate(query);
    },
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) =>
      listeners.set(cb, query),
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) =>
      listeners.delete(cb),
  }) as unknown as MediaQueryList;

function resizeTo(next: number) {
  act(() => {
    width = next;
    listeners.forEach((query, cb) => cb({ matches: evaluate(query) }));
  });
}

function setNavigator(userAgent: string, maxTouchPoints = 0, mobileHint?: boolean) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(maxTouchPoints);
  Object.defineProperty(navigator, 'userAgentData', {
    configurable: true,
    value: mobileHint === undefined ? undefined : { mobile: mobileHint },
  });
}

const renderGate = () =>
  render(
    <WebAccessGate>
      <p>conteúdo do app</p>
    </WebAccessGate>
  );

const DEVICE_TITLE = ptBR.webAccess.device.title;
const SMALL_TITLE = ptBR.webAccess.smallWindow.title;
const appText = () => screen.queryByText('conteúdo do app');
const hasText = (text: string) => document.body.textContent?.includes(text) ?? false;

beforeEach(() => {
  width = 1920;
  coarseOnly = false;
  listeners.clear();
  vi.spyOn(window, 'matchMedia').mockImplementation(fakeMatchMedia);
  setNavigator(UA.windowsChrome);
  useWebAccessStore.setState({ serverBlocked: false });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isMobileOrTabletDevice', () => {
  it('libera PC e notebook', () => {
    for (const ua of [UA.windowsChrome, UA.macSafari, UA.linuxDesktop]) {
      setNavigator(ua);
      expect(isMobileOrTabletDevice()).toBe(false);
    }
  });

  it('libera notebook com touchscreen (tem ponteiro fino)', () => {
    setNavigator(UA.windowsChrome, 10);
    expect(isMobileOrTabletDevice()).toBe(false);
  });

  it('detecta smartphone e tablet Android pelo UA', () => {
    setNavigator(UA.iphone, 5);
    expect(isMobileOrTabletDevice()).toBe(true);
    setNavigator(UA.androidTablet, 10);
    expect(isMobileOrTabletDevice()).toBe(true);
  });

  it('detecta iPadOS que se apresenta como Mac (toque + Macintosh)', () => {
    setNavigator(UA.macSafari, 5);
    expect(isMobileOrTabletDevice()).toBe(true);
  });

  it('detecta pelo Client Hint mobile', () => {
    setNavigator(UA.windowsChrome, 0, true);
    expect(isMobileOrTabletDevice()).toBe(true);
  });

  it('detecta tablet em modo desktop (UA Linux, só ponteiro grosso)', () => {
    setNavigator(UA.linuxDesktop, 10);
    coarseOnly = true;
    expect(isMobileOrTabletDevice()).toBe(true);
  });
});

describe('isWebDeviceBlockResponse', () => {
  it('só reconhece o 403 com o código da política', () => {
    expect(isWebDeviceBlockResponse(403, { code: 'web_device_not_allowed' })).toBe(
      true
    );
    expect(isWebDeviceBlockResponse(403, { detail: 'Sem permissão' })).toBe(false);
    expect(isWebDeviceBlockResponse(401, { code: 'web_device_not_allowed' })).toBe(
      false
    );
  });
});

describe('WebAccessGate', () => {
  it('mostra o app em PC com viewport adequada', () => {
    renderGate();
    expect(appText()).not.toBeNull();
  });

  it('mostra o app em notebook no limite mínimo', () => {
    width = MIN_VIEWPORT_WIDTH;
    renderGate();
    expect(appText()).not.toBeNull();
  });

  it('bloqueia smartphone, mesmo com viewport larga', () => {
    setNavigator(UA.iphone, 5);
    renderGate();
    expect(appText()).toBeNull();
    expect(hasText(DEVICE_TITLE)).toBe(true);
  });

  it('bloqueio de dispositivo tem prioridade sobre janela pequena', () => {
    setNavigator(UA.androidTablet, 10);
    width = 800;
    renderGate();
    expect(hasText(DEVICE_TITLE)).toBe(true);
    expect(hasText(SMALL_TITLE)).toBe(false);
  });

  it('janela pequena esconde o app e libera ao ampliar, sem recarregar', () => {
    width = MIN_VIEWPORT_WIDTH - 1;
    renderGate();
    expect(appText()).toBeNull();
    expect(hasText(SMALL_TITLE)).toBe(true);

    resizeTo(1366);
    expect(appText()).not.toBeNull();

    resizeTo(1000);
    expect(appText()).toBeNull();
  });

  it('bloqueia quando o backend responde web_device_not_allowed', () => {
    renderGate();
    act(() => useWebAccessStore.setState({ serverBlocked: true }));
    expect(appText()).toBeNull();
    expect(hasText(DEVICE_TITLE)).toBe(true);
  });
});
