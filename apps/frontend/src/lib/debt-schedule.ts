import { formatLocalDate, parseLocalDate } from './utils';

/**
 * Próxima ocorrência do dia de vencimento de uma dívida em/depois de hoje.
 *
 * Espelha `apps/api/app/debt_installment_utils.py:default_first_due_date` —
 * usado para pré-preencher o campo "1ª parcela" nos diálogos de plano de
 * pagamento, garantindo que o cronograma nunca comece no passado.
 *
 * @param referenceDate data de referência (ISO) — normalmente a data de
 *   registro ou o vencimento original da dívida; só o dia do mês é usado.
 * @returns data `YYYY-MM-DD`
 */
export function nextDueDateOnOrAfterToday(referenceDate?: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ref = referenceDate ? parseLocalDate(referenceDate) : undefined;
  const day = ref ? ref.getDate() : today.getDate();

  const daysIn = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();

  let candidate = new Date(
    today.getFullYear(),
    today.getMonth(),
    Math.min(day, daysIn(today.getFullYear(), today.getMonth()))
  );

  if (candidate.getTime() < today.getTime()) {
    candidate = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      Math.min(day, daysIn(today.getFullYear(), today.getMonth() + 1))
    );
  }

  return formatLocalDate(candidate);
}
