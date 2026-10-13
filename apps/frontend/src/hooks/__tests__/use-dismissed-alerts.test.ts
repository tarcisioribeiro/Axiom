import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { FinancialAlert } from '@/types';

import { alertKey, useDismissedAlerts } from '../use-dismissed-alerts';

const payable = (id: string, severity: FinancialAlert['severity'] = 'warning') =>
  ({
    type: 'payable_due',
    severity,
    message: `Conta ${id}`,
    link: '/payables',
    metadata: { payable_id: id, days_left: 2 },
  }) satisfies FinancialAlert;

describe('useDismissedAlerts', () => {
  beforeEach(() => localStorage.clear());

  it('mantém o alerta dispensado após recarregar a página', () => {
    const alerts = [payable('a'), payable('b')];
    const { result, unmount } = renderHook(() => useDismissedAlerts(alerts, 1));

    act(() => result.current.dismiss(alertKey(alerts[0])));
    expect(result.current.visibleAlerts).toEqual([alerts[1]]);

    unmount();
    const reloaded = renderHook(() => useDismissedAlerts(alerts, 1));
    expect(reloaded.result.current.visibleAlerts).toEqual([alerts[1]]);
  });

  it('reexibe o alerta se ele agravar ou se for de outro usuário', () => {
    const alerts = [payable('a')];
    const { result } = renderHook(() => useDismissedAlerts(alerts, 1));
    act(() => result.current.dismiss(alertKey(alerts[0])));

    const worse = [payable('a', 'danger')];
    expect(
      renderHook(() => useDismissedAlerts(worse, 1)).result.current.visibleAlerts
    ).toEqual(worse);
    expect(
      renderHook(() => useDismissedAlerts(alerts, 2)).result.current.visibleAlerts
    ).toEqual(alerts);
  });

  it('esquece dispensas de alertas que deixaram de existir', () => {
    const first = [payable('a'), payable('b')];
    const { result, rerender } = renderHook(
      ({ alerts }) => useDismissedAlerts(alerts, 1),
      { initialProps: { alerts: first } }
    );
    act(() => result.current.dismiss(alertKey(first[0])));

    // 'a' foi resolvido; ao dispensar 'b' a dispensa de 'a' é descartada
    rerender({ alerts: [first[1]] });
    act(() => result.current.dismiss(alertKey(first[1])));

    rerender({ alerts: first });
    expect(result.current.visibleAlerts).toEqual([first[0]]);
  });
});
