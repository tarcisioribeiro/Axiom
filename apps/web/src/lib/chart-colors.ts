import { useSyncExternalStore, useMemo, useId } from 'react';

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Os tokens de cor em index.css guardam o triplo HSL cru ("H S% L%"), consumido
// via hsl(var(--x)) no CSS. Aqui fazemos o mesmo encapsulamento manualmente.
function themeColor(name: string): string {
  const value = cssVar(name);
  return value ? `hsl(${value})` : '#888888';
}

// ── Shared module-level observer ────────────────────────────────
// Um único MutationObserver observa a classe e os atributos de variante de
// tema em <html> e notifica todos os assinantes React. Cobre tanto o toggle
// dark/light quanto a troca entre as 14 variantes adicionais (Catppuccin,
// Tokyo Night, Gruvbox, ...), então gráficos/cores reagem à troca de
// qualquer um dos 16 temas, não só ao toggle binário.
function buildThemeKey(): string {
  const el = document.documentElement;
  return `${el.classList.contains('dark') ? 'dark' : 'light'}:${el.getAttribute('data-dark-theme') ?? ''}:${el.getAttribute('data-light-theme') ?? ''}`;
}

let _themeKey = buildThemeKey();
const _listeners = new Set<() => void>();

new MutationObserver(() => {
  const next = buildThemeKey();
  if (next !== _themeKey) {
    _themeKey = next;
    _listeners.forEach((fn) => fn());
  }
}).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class', 'data-dark-theme', 'data-light-theme'],
});

function _subscribe(listener: () => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

function _getThemeKey(): string {
  return _themeKey;
}

/**
 * Hook reativo para a chave completa de tema (dark/light + variante).
 * Dispara re-render quando o usuário troca de tema claro/escuro OU de
 * variante dentro do mesmo modo.
 */
function useThemeKey(): string {
  return useSyncExternalStore(_subscribe, _getThemeKey);
}

// ── Pure (non-hook) helpers ───────────────────────────────────────────────────

export type SemanticColor =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'primary'
  | 'accent'
  | 'caution'
  | 'neutral';

const SEMANTIC_VAR_MAP: Record<SemanticColor, string> = {
  success: '--success',
  warning: '--warning',
  danger: '--destructive',
  info: '--info',
  primary: '--primary',
  accent: '--accent',
  caution: '--category-nutrition',
  neutral: '--muted-foreground',
};

/**
 * Retorna cores semânticas baseadas no tema ativo (qualquer uma das 16 variantes)
 */
const getSemanticColors = (): Record<SemanticColor, string> => {
  const entries = Object.entries(SEMANTIC_VAR_MAP) as [SemanticColor, string][];
  return Object.fromEntries(
    entries.map(([key, varName]) => [key, themeColor(varName)])
  ) as Record<SemanticColor, string>;
};

// 8 tons distintos para séries de gráfico, lidos dos tokens de tema em vez
// de uma tabela hex fixa por tema (antes só cobria Alucard/Dracula).
const CHART_SERIES_VARS = [
  '--primary',
  '--accent',
  '--info',
  '--success',
  '--category-nutrition',
  '--category-exercise',
  '--destructive',
  '--muted-foreground',
];

/**
 * Retorna a paleta de cores atual baseada no tema ativo
 */
const getChartColors = (): string[] => CHART_SERIES_VARS.map(themeColor);

export type TaskCategoryKey =
  | 'health'
  | 'studies'
  | 'spiritual'
  | 'exercise'
  | 'nutrition'
  | 'meditation'
  | 'reading'
  | 'writing'
  | 'work'
  | 'leisure'
  | 'family'
  | 'social'
  | 'finance'
  | 'household'
  | 'personal_care'
  | 'other';

const TASK_CATEGORY_VAR_MAP: Record<TaskCategoryKey, string> = {
  health: '--category-health',
  studies: '--category-studies',
  spiritual: '--category-spiritual',
  exercise: '--category-exercise',
  nutrition: '--category-nutrition',
  meditation: '--accent',
  reading: '--muted-foreground',
  writing: '--destructive',
  work: '--muted-foreground',
  leisure: '--accent',
  family: '--destructive',
  social: '--category-exercise',
  finance: '--info',
  household: '--category-nutrition',
  personal_care: '--primary',
  other: '--muted-foreground',
};

/**
 * Retorna cores para categorias de tarefas baseadas no tema ativo.
 * Cada categoria mapeia para um token semântico/de categoria já definido em
 * index.css, então fica correto nas 16 variantes de tema sem tabela própria.
 */
const getTaskCategoryColors = (): Record<TaskCategoryKey, string> => {
  const entries = Object.entries(TASK_CATEGORY_VAR_MAP) as [TaskCategoryKey, string][];
  return Object.fromEntries(
    entries.map(([key, varName]) => [key, themeColor(varName)])
  ) as Record<TaskCategoryKey, string>;
};

// ── Reactive hooks ────────────────────────────────────────────────────────────
// Todos os hooks reagem a useThemeKey(), que cobre troca de dark/light e de
// variante, via o MutationObserver compartilhado acima.

/**
 * Hook reativo que retorna a paleta de cores para gráficos.
 */
export const useChartColors = (): string[] => {
  const themeKey = useThemeKey();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getChartColors(), [themeKey]);
};

/**
 * Hook reativo para cores semânticas
 */
export const useSemanticColors = () => {
  const themeKey = useThemeKey();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getSemanticColors(), [themeKey]);
};

/**
 * Hook reativo para cores de categorias de tarefas
 */
export const useTaskCategoryColors = () => {
  const themeKey = useThemeKey();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getTaskCategoryColors(), [themeKey]);
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
