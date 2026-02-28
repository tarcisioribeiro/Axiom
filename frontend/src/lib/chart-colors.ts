import { useEffect, useState, useMemo, useId } from 'react';

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
 * Hook reativo que atualiza cores quando o tema muda
 * Usa MutationObserver para detectar mudanças na classe 'dark' do HTML
 */
export const useChartColors = () => {
  const [colors, setColors] = useState(getChartColors);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setColors(getChartColors());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return colors;
};

/**
 * Hook reativo para cores semânticas
 */
export const useSemanticColors = () => {
  const [colors, setColors] = useState(getSemanticColors);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setColors(getSemanticColors());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return colors;
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
 * Hook reativo para cores de força de senha
 */
export const usePasswordStrengthColors = () => {
  const [colors, setColors] = useState(getPasswordStrengthColors);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setColors(getPasswordStrengthColors());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return colors;
};

/**
 * Retorna cores para categorias de tarefas baseadas no tema
 */
export const getTaskCategoryColors = () => {
  if (isDarkTheme()) {
    const palette = DRACULA_PALETTE;
    return {
      health: palette.green,
      studies: palette.cyan,
      spiritual: palette.purple,
      exercise: palette.orange,
      nutrition: palette.green,
      meditation: palette.purple,
      reading: palette.yellow,
      writing: palette.cyan,
      work: palette.comment,
      leisure: palette.pink,
      family: palette.red,
      social: palette.orange,
      finance: palette.green,
      household: palette.yellow,
      personal_care: palette.cyan,
      other: palette.comment,
    };
  } else {
    const palette = ALUCARD_PALETTE;
    return {
      health: palette.green,
      studies: palette.blue,
      spiritual: palette.purple,
      exercise: palette.orange,
      nutrition: palette.green,
      meditation: palette.purple,
      reading: palette.yellow,
      writing: palette.blue,
      work: palette.comment,
      leisure: palette.pink,
      family: palette.red,
      social: palette.orange,
      finance: palette.green,
      household: palette.yellow,
      personal_care: palette.blue,
      other: palette.comment,
    };
  }
};

/**
 * Hook reativo para cores de categorias de tarefas
 */
export const useTaskCategoryColors = () => {
  const [colors, setColors] = useState(getTaskCategoryColors);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setColors(getTaskCategoryColors());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return colors;
};

// Exporta as paletas para uso direto se necessário
export { ALUCARD_PALETTE, DRACULA_PALETTE };
