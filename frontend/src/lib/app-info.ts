declare const __APP_VERSION__: string;

export const APP_VERSION: string = __APP_VERSION__;

// VITE_APP_ENV deve ser definido como "staging" ou "production".
// Em desenvolvimento, cai no import.meta.env.MODE ("development").
export const APP_ENV: string =
  import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE ?? 'development';

export const IS_PRODUCTION = APP_ENV === 'production';
