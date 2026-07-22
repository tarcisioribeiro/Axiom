import { useSyncExternalStore, useMemo, useId } from 'react';

/**
 * Sistema de cores para gráficos Recharts
 * Paletas adaptadas ao tema atual (light/dark)
 * Baseado nas paletas Alucard (light) e Dracula (dark)
 */

// Paleta light - Alucard Classic
const ALUCARD_PALETTE = {
  purple: '#644AC9',
  pink: '#A3144D',
  blue: '#036A96',
  green: '#14710A',
  yellow: '#857228',
  orange: '#A34D14',
  red: '#CB3A2A',
  comment: '#6C664B',
} as const;

// Paleta dark - Dracula Classic
const DRACULA_PALETTE = {
  purple: '#bd93f9',
  pink: '#ff79c6',
  cyan: '#8be9fd',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  orange: '#ffb86c',
  red: '#ff5555',
  comment: '#6272a4',
} as const;

// Cores semânticas para cada tema
const SEMANTIC_COLORS = {
  light: {
    success: ALUCARD_PALETTE.green,
    warning: ALUCARD_PALETTE.orange,
    danger: ALUCARD_PALETTE.red,
    info: ALUCARD_PALETTE.blue,
    primary: ALUCARD_PALETTE.purple,
    accent: ALUCARD_PALETTE.pink,
    caution: ALUCARD_PALETTE.yellow,
    neutral: ALUCARD_PALETTE.comment,
  },
  dark: {
    success: DRACULA_PALETTE.green,
    warning: DRACULA_PALETTE.orange,
    danger: DRACULA_PALETTE.red,
    info: DRACULA_PALETTE.cyan,
    primary: DRACULA_PALETTE.purple,
    accent: DRACULA_PALETTE.pink,
    caution: DRACULA_PALETTE.yellow,
    neutral: DRACULA_PALETTE.comment,
  },
} as const;

export type SemanticColor = keyof typeof SEMANTIC_COLORS.light;

/**
 * Verifica se o tema atual é dark
 */
export const isDarkTheme = (): boolean => {
  return document.documentElement.classList.contains('dark');
};

// ── Shared module-level observer (Issue 1 fix) ────────────────────────────────
// A single MutationObserver watches the <html> class attribute and notifies
// all React subscribers. This replaces the pattern of each hook creating its
// own observer (O(components) → O(1)).
let _isDark = isDarkTheme();
const _listeners = new Set<() => void>();

new MutationObserver(() => {
  _isDark = isDarkTheme();
  _listeners.forEach((fn) => fn());
}).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

function _subscribe(listener: () => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

function _getIsDark(): boolean {
  return _isDark;
}

/**
 * Hook reativo para o estado dark/light do tema.
 * Baseado num único MutationObserver compartilhado por toda a aplicação.
 */
export const useIsDarkTheme = (): boolean =>
  useSyncExternalStore(_subscribe, _getIsDark);

// ── Pure (non-hook) helpers ───────────────────────────────────────────────────

/**
 * Retorna a paleta de cores atual baseada no tema
 */
export const getChartColors = (): string[] => {
  if (isDarkTheme()) {
    return Object.values(DRACULA_PALETTE);
  }
  return Object.values(ALUCARD_PALETTE);
};

/**
 * Retorna cores semânticas baseadas no tema
 */
export const getSemanticColors = () => {
  return isDarkTheme() ? SEMANTIC_COLORS.dark : SEMANTIC_COLORS.light;
};

/**
 * Retorna uma cor semântica específica
 */
export const getSemanticColor = (color: SemanticColor): string => {
  const colors = getSemanticColors();
  return colors[color];
};

/**
 * Retorna cor com opacidade ajustada
 */
export const withOpacity = (color: string, opacity: number): string => {
  // Se for hex, converte para rgba
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
};

/**
 * Retorna cores para força de senha baseadas no tema
 */
export const getPasswordStrengthColors = () => {
  const palette = isDarkTheme() ? DRACULA_PALETTE : ALUCARD_PALETTE;
  return {
    weak: palette.red,
    medium: palette.yellow,
    strong: palette.green,
  };
};

/**
 * Retorna cores para categorias de tarefas baseadas no tema.
 * Cada categoria tem uma cor distinta para evitar ambiguidade em gráficos.
 */
export const getTaskCategoryColors = () => {
  if (isDarkTheme()) {
    const p = DRACULA_PALETTE;
    return {
      health: p.green,
      studies: p.cyan,
      spiritual: p.purple,
      exercise: p.orange,
      nutrition: p.yellow,
      meditation: p.pink,
      reading: p.comment,
      writing: p.red,
      work: p.comment,
      leisure: p.pink,
      family: p.red,
      social: p.orange,
      finance: p.cyan,
      household: p.yellow,
      personal_care: p.purple,
      other: p.comment,
    };
  } else {
    const p = ALUCARD_PALETTE;
    return {
      health: p.green,
      studies: p.blue,
      spiritual: p.purple,
      exercise: p.orange,
      nutrition: p.yellow,
      meditation: p.pink,
      reading: p.comment,
      writing: p.red,
      work: p.comment,
      leisure: p.pink,
      family: p.red,
      social: p.orange,
      finance: p.blue,
      household: p.yellow,
      personal_care: p.purple,
      other: p.comment,
    };
  }
};

// ── Reactive hooks ────────────────────────────────────────────────────────────
// All hooks use useIsDarkTheme() which is backed by the single shared observer.

/**
 * Hook reativo que retorna a paleta de cores para gráficos.
 */
export const useChartColors = (): string[] => {
  const dark = useIsDarkTheme();
  return useMemo(
    () => (dark ? Object.values(DRACULA_PALETTE) : Object.values(ALUCARD_PALETTE)),
    [dark]
  );
};

/**
 * Hook reativo para cores semânticas
 */
export const useSemanticColors = () => {
  const dark = useIsDarkTheme();
  return useMemo(() => (dark ? SEMANTIC_COLORS.dark : SEMANTIC_COLORS.light), [dark]);
};

/**
 * Hook reativo para cores de força de senha
 */
export const usePasswordStrengthColors = () => {
  const dark = useIsDarkTheme();
  return useMemo(() => {
    const palette = dark ? DRACULA_PALETTE : ALUCARD_PALETTE;
    return { weak: palette.red, medium: palette.yellow, strong: palette.green };
  }, [dark]);
};

/**
 * Hook reativo para cores de categorias de tarefas
 */
export const useTaskCategoryColors = () => {
  const dark = useIsDarkTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getTaskCategoryColors(), [dark]);
};

/**
 * Hook para gerar IDs únicos para gradientes de gráficos
 * Evita colisões entre múltiplas instâncias do mesmo componente
 */
export const useChartGradientId = (prefix: string) => {
  const uniqueId = useId();

  return useMemo(() => {
    // Remove caracteres especiais do useId (como :)
    const cleanId = uniqueId.replace(/:/g, '');
    return (index: number) => `${prefix}-${cleanId}-${index}`;
  }, [prefix, uniqueId]);
};

// Exporta as paletas para uso direto se necessário
export { ALUCARD_PALETTE, DRACULA_PALETTE };
