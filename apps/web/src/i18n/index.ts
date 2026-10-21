import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { z } from 'zod';
import { en, pt } from 'zod/locales';

import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';

const LANG_STORAGE_KEY = 'axiom-lang';

const ZOD_LOCALES: Record<string, () => ReturnType<typeof pt>> = {
  'pt-BR': pt,
  'en-US': en,
};

/** Fallback do Zod para validações sem mensagem customizada (ex.: "Invalid input"). */
const syncZodLocale = (lang: string) => {
  z.config((ZOD_LOCALES[lang] ?? pt)());
};

const savedLang = localStorage.getItem(LANG_STORAGE_KEY) ?? 'pt-BR';
syncZodLocale(savedLang);

void i18next.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
    'en-US': { translation: enUS },
  },
  lng: savedLang,
  fallbackLng: 'pt-BR',
  interpolation: {
    escapeValue: false,
  },
});

i18next.on('languageChanged', (lang) => {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  syncZodLocale(lang);
});

export default i18next;
