import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';

const LANG_STORAGE_KEY = 'axiom-lang';

const savedLang = localStorage.getItem(LANG_STORAGE_KEY) ?? 'pt-BR';

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
});

export default i18next;
