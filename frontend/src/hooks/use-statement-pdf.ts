import { pdf } from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import React, { useState, useCallback } from 'react';

import { StatementDocument } from '@/components/pdf/StatementDocument';
import type {
  StatementData,
  StatementTransaction,
} from '@/components/pdf/StatementDocument';
import { translate } from '@/config/constants';
import { logger } from '@/lib/logger';
import { dashboardService } from '@/services/dashboard-service';
import { expensesService } from '@/services/expenses-service';
import { revenuesService } from '@/services/revenues-service';
import { useAuthStore } from '@/stores/auth-store';

export interface StatementParams {
  dateFrom: string;
  dateTo: string;
}

interface UseStatementPdfReturn {
  isGenerating: boolean;
  generateStatement: (params: StatementParams) => Promise<void>;
}

function formatStatementDate(isoDate: string): string {
  try {
    const [year, month, day] = isoDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return isoDate;
  }
}

function formatPeriodLabel(isoDate: string): string {
  try {
    const [year, month, day] = isoDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return isoDate;
  }
}

export function useStatementPdf(): UseStatementPdfReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const user = useAuthStore((s) => s.user);

  const generateStatement = useCallback(
    async ({ dateFrom, dateTo }: StatementParams): Promise<void> => {
      setIsGenerating(true);

      try {
        // Fetch all data in parallel — up to 500 items per resource in the date range
        const [expenses, revenues, accounts] = await Promise.all([
          expensesService.getAll({
            date_from: dateFrom,
            date_to: dateTo,
            page_size: 500,
          }),
          revenuesService.getAll({
            date_from: dateFrom,
            date_to: dateTo,
            page_size: 500,
          }),
          dashboardService.getAccountBalances(),
        ]);

        // ── Build unified transaction list, sorted by date desc ───────────────
        const transactions: StatementTransaction[] = [
          ...expenses
            .filter((e) => !e.related_transfer)
            .map((e) => ({
              id: e.id,
              date: formatStatementDate(e.date),
              description: e.description,
              category: translate('expenseCategories', e.category),
              account_name: e.account_name ?? '',
              value: e.value,
              type: 'expense' as const,
              is_transfer: false,
            })),
          ...revenues
            .filter((r) => !r.related_transfer)
            .map((r) => ({
              id: r.id,
              date: formatStatementDate(r.date),
              description: r.description,
              category: translate('revenueCategories', r.category),
              account_name: r.account_name ?? '',
              value: r.value,
              type: 'revenue' as const,
              is_transfer: false,
            })),
        ].sort((a, b) => {
          // Parse back dd/MM/yyyy → comparable string yyyy-MM-dd
          const toComparable = (d: string) => d.split('/').reverse().join('-');
          return toComparable(b.date).localeCompare(toComparable(a.date));
        });

        // ── Totals (excluindo transferências) ─────────────────────────────────
        const totalRevenues = revenues
          .filter((r) => r.received && !r.related_transfer)
          .reduce((sum, r) => sum + parseFloat(r.value), 0);

        const totalExpenses = expenses
          .filter((e) => e.payed && !e.related_transfer)
          .reduce((sum, e) => sum + parseFloat(e.value), 0);

        const netBalance = totalRevenues - totalExpenses;

        // ── User display name ─────────────────────────────────────────────────
        const userName = user
          ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
          : 'Usuário';

        const data: StatementData = {
          period: {
            from: formatPeriodLabel(dateFrom),
            to: formatPeriodLabel(dateTo),
          },
          generatedAt: format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
          userName,
          totalRevenues,
          totalExpenses,
          netBalance,
          accounts: accounts.map((a) => ({
            id: a.id,
            account_name: a.account_name,
            institution: a.institution_name ?? '',
            balance: String(a.current_balance ?? 0),
          })),
          transactions,
        };

        // ── Generate PDF blob and trigger download ────────────────────────────
        const blob = await pdf(
          React.createElement(StatementDocument, {
            data,
          }) as unknown as React.ReactElement<DocumentProps>
        ).toBlob();

        const filename = `extrato_${dateFrom}_${dateTo}.pdf`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        logger.error('[useStatementPdf] Erro ao gerar extrato:', err);
        throw err;
      } finally {
        setIsGenerating(false);
      }
    },
    [user]
  );

  return { isGenerating, generateStatement };
}
