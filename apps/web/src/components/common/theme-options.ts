import type { DarkVariant, LightVariant } from '@/hooks/use-theme';

/** Cores HSL de cada tema (cópia de index.css) — a prévia não pode usar as
 * variáveis do <html>, que só valem para o tema ativo. */
export interface ThemeOption<T> {
  id: T;
  label: string;
  bg: string;
  card: string;
  fg: string;
  primary: string;
}

export const LIGHT_THEMES: ThemeOption<LightVariant>[] = [
  {
    id: 'alucard',
    label: 'Alucard',
    bg: '48 100% 96%',
    card: '48 100% 98%',
    fg: '0 0% 12%',
    primary: '252 54% 54%',
  },
  {
    id: 'catppuccin-latte',
    label: 'Catppuccin Latte',
    bg: '220 23% 95%',
    card: '220 23% 97%',
    fg: '234 16% 36%',
    primary: '266 85% 58%',
  },
  {
    id: 'tokyo-day',
    label: 'Tokyo Day',
    bg: '230 11% 89%',
    card: '240 10% 92%',
    fg: '222 55% 48%',
    primary: '215 81% 55%',
  },
  {
    id: 'gruvbox-light',
    label: 'Gruvbox Light',
    bg: '46 79% 88%',
    card: '46 79% 90%',
    fg: '8 5% 22%',
    primary: '24 88% 45%',
  },
  {
    id: 'everforest-light',
    label: 'Everforest Light',
    bg: '48 39% 92%',
    card: '48 39% 94%',
    fg: '202 11% 40%',
    primary: '201 55% 50%',
  },
  {
    id: 'ubuntu-light',
    label: 'Ubuntu Light',
    bg: '0 0% 100%',
    card: '306 15% 98%',
    fg: '319 66% 11%',
    primary: '16 82% 52%',
  },
  {
    id: 'mint-light',
    label: 'Linux Mint Light',
    bg: '240 8% 97%',
    card: '0 0% 100%',
    fg: '0 0% 19%',
    primary: '200 75% 42%',
  },
];

export const DARK_THEMES: ThemeOption<DarkVariant>[] = [
  {
    id: 'dracula',
    label: 'Dracula',
    bg: '235 15% 18%',
    card: '232 14% 31%',
    fg: '60 30% 96%',
    primary: '265 89% 78%',
  },
  {
    id: 'catppuccin-mocha',
    label: 'Catppuccin Mocha',
    bg: '240 21% 15%',
    card: '237 16% 23%',
    fg: '226 64% 88%',
    primary: '267 84% 81%',
  },
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    bg: '234 18% 13%',
    card: '224 37% 20%',
    fg: '226 72% 86%',
    primary: '218 87% 72%',
  },
  {
    id: 'gruvbox-dark',
    label: 'Gruvbox Dark',
    bg: '0 0% 16%',
    card: '6 4% 23%',
    fg: '43 60% 80%',
    primary: '42 95% 58%',
  },
  {
    id: 'everforest',
    label: 'Everforest',
    bg: '205 14% 20%',
    card: '205 12% 23%',
    fg: '41 32% 75%',
    primary: '172 31% 62%',
  },
  {
    id: 'ubuntu',
    label: 'Ubuntu Dark',
    bg: '319 66% 11%',
    card: '319 45% 17%',
    fg: '0 0% 100%',
    primary: '16 82% 52%',
  },
  {
    id: 'mint-dark',
    label: 'Linux Mint Dark',
    bg: '240 5% 19%',
    card: '240 5% 22%',
    fg: '0 0% 85%',
    primary: '200 75% 50%',
  },
];
