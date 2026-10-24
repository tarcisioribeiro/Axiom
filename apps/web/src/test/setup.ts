import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, vi } from 'vitest';

import enUS from '@/i18n/locales/en-US.json';
import ptBR from '@/i18n/locales/pt-BR.json';

// Controle de acesso por tela: acesso total por padrão nos testes (o hook real
// consulta /me via TanStack Query). Testes de permissão sobrescrevem com vi.mock.
vi.mock('@/hooks/use-screen-access', () => ({
  useScreenAccess: () => ({ ready: true, can: () => true, canModule: () => true }),
  useCurrentScreen: () => ({ screen: undefined, can: () => true }),
}));

// Required for React 19 act() support in non-browser test environments
// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is a React internal testing global
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      lng: 'pt-BR',
      fallbackLng: 'pt-BR',
      resources: {
        'pt-BR': { translation: ptBR },
        'en-US': { translation: enUS },
      },
      interpolation: { escapeValue: false },
    });
  }
});

afterEach(() => {
  cleanup();
});

// happy-dom 21 rejects an Animation's `finished` promise with AbortError on
// cancel (spec-correct), but motion-dom doesn't await/catch it when stopping
// animations on unmount — pure test-teardown noise, not an app bug.
// ponytail: global filter, scope to the stack trace if other legit AbortErrors start getting swallowed.
process.on('unhandledRejection', (reason) => {
  if (
    reason instanceof Error &&
    reason.name === 'AbortError' &&
    reason.message === 'The animation was canceled.'
  ) {
    return;
  }
  throw reason;
});
