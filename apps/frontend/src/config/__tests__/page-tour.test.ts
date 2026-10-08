import { describe, expect, it } from 'vitest';

import { getTourKey } from '../page-tour';

describe('getTourKey', () => {
  it('casa uma rota exata', () => {
    expect(getTourKey('/transactions')).toBe('transactions');
  });

  it('sobe um nível para achar a página pai de uma rota com aba', () => {
    expect(getTourKey('/transactions/expenses')).toBe('transactions');
  });

  it('sobe dois níveis para uma sub-aba aninhada', () => {
    expect(getTourKey('/planning/tasks-goals/routine/focus-blocks')).toBe('tasksGoals');
  });

  it('casa o padrão de detalhe de conciliação bancária', () => {
    expect(getTourKey('/bank-reconciliation/abc123')).toBe('bankReconciliationDetail');
  });

  it('retorna undefined para rota desconhecida', () => {
    expect(getTourKey('/rota/que/nao/existe')).toBeUndefined();
  });
});
