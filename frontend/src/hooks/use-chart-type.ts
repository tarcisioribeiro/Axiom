import { useState } from 'react';

import type { ChartType } from '@/lib/chart-types';

// Re-exporta o tipo para compatibilidade
export type { ChartType };

const CHART_CYCLE: Record<ChartType, ChartType> = {
  pie: 'bar',
  bar: 'line',
  line: 'pie',
};

const isValidChartType = (value: string): value is ChartType => {
  return value === 'pie' || value === 'bar' || value === 'line';
};

/**
 * Hook para gerenciar o tipo de gráfico com persistência no localStorage
 * @param chartId - ID único para identificar o gráfico no localStorage
 * @param defaultType - Tipo padrão do gráfico (padrão: 'pie')
 * @returns Objeto com chartType atual e função para alternar entre tipos
 */
export const useChartType = (chartId: string, defaultType: ChartType = 'pie') => {
  const storageKey = `chart-type-${chartId}`;

  const [chartType, setChartTypeState] = useState<ChartType>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && isValidChartType(stored)) {
        return stored;
      }
    } catch (error) {
      console.warn('Erro ao ler preferência de gráfico do localStorage:', error);
    }
    return defaultType;
  });

  const cycleChartType = () => {
    setChartTypeState((prev) => {
      const next = CHART_CYCLE[prev];
      try {
        localStorage.setItem(storageKey, next);
      } catch (error) {
        console.warn('Erro ao salvar preferência de gráfico no localStorage:', error);
      }
      return next;
    });
  };

  return { chartType, cycleChartType };
};
