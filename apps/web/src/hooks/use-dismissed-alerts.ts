import { useCallback, useMemo, useState } from 'react';

import type { FinancialAlert } from '@/types';

const ID_FIELD: Record<FinancialAlert['type'], string> = {
  budget_limit: 'budget_id',
  credit_card_bill_due: 'bill_id',
  low_balance: 'account_id',
  payable_due: 'payable_id',
  loan_due: 'loan_id',
};

/**
 * Chave estável do alerta: tipo + item + severidade. Se o alerta agravar
 * (warning → danger) a chave muda e ele volta a aparecer.
 */
export const alertKey = (alert: FinancialAlert): string => {
  const id = alert.metadata[ID_FIELD[alert.type]];
  return `${alert.type}:${typeof id === 'string' ? id : alert.message}:${alert.severity}`;
};

const readDismissed = (storageKey: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

/**
 * Alertas financeiros dispensados, persistidos no localStorage por usuário.
 * ponytail: persistência por navegador; mover para o backend se precisar
 * sincronizar dispensas entre dispositivos.
 */
export function useDismissedAlerts(alerts: FinancialAlert[], userId?: number) {
  const storageKey = `dismissed-financial-alerts-${userId ?? 'anon'}`;
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey));

  const visibleAlerts = useMemo(
    () => alerts.filter((alert) => !dismissed.includes(alertKey(alert))),
    [alerts, dismissed]
  );

  const dismiss = useCallback(
    (key: string) => {
      // Mantém só dispensas de alertas ainda ativos: se a condição for
      // resolvida e voltar a ocorrer, o alerta reaparece.
      const active = new Set(alerts.map(alertKey));
      const next = [...dismissed.filter((k) => active.has(k) && k !== key), key];
      setDismissed(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // localStorage indisponível: a dispensa vale só para esta sessão
      }
    },
    [alerts, dismissed, storageKey]
  );

  return { visibleAlerts, dismiss };
}
