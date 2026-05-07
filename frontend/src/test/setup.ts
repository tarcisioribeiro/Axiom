import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { afterEach, beforeAll } from 'vitest';

import enUS from '@/i18n/locales/en-US.json';
import ptBR from '@/i18n/locales/pt-BR.json';

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
