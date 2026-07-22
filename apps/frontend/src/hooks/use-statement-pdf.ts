import { pdf } from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { StatementDocument } from '@/components/pdf/StatementDocument';
import type {
  StatementData,
  StatementLabels,
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

export function useStatementPdf(): UseStatementPdfReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const user = useAuthStore((s) => s.user);
  const { t, i18n } = useTranslation();

  const generateStatement = useCallback(
    async ({ dateFrom, dateTo }: StatementParams): Promise<void> => {
      setIsGenerating(true);

      const locale = i18n.language === 'en-US' ? enUS : ptBR;

      const formatStatementDate = (isoDate: string): string => {
        try {
          const [year, month, day] = isoDate.split('-').map(Number);
          return format(new Date(year, month - 1, day), 'dd/MM/yyyy', { locale });
        } catch {
          return isoDate;
        }
      };

      const formatPeriodLabel = (isoDate: string): string => {
        try {
          const [year, month, day] = isoDate.split('-').map(Number);
          const date = new Date(year, month - 1, day);
          return i18n.language === 'en-US'
            ? format(date, 'MMMM d, yyyy', { locale })
            : format(date, "dd 'de' MMMM 'de' yyyy", { locale });
        } catch {
          return isoDate;
        }
      };

      const formatGeneratedAt = (): string => {
        const now = new Date();
        return i18n.language === 'en-US'
          ? format(now, "MM/dd/yyyy 'at' HH:mm", { locale })
          : format(now, "dd/MM/yyyy 'às' HH:mm", { locale });
      };

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
          : '';

        // ── Build labels from i18n ────────────────────────────────────────────
        const labels: StatementLabels = {
          docTitle: t('pages.dashboard.statementPdf.title'),
          tagline: t('pages.dashboard.statementPdf.tagline'),
          pdfTitle: t('pages.dashboard.statementPdf.title'),
          period: t('pages.dashboard.statementPdf.period'),
          holder: t('pages.dashboard.statementPdf.holder'),
          generatedAt: t('pages.dashboard.statementPdf.generatedAt'),
          totalRevenues: t('pages.dashboard.statementPdf.totalRevenues'),
          totalExpenses: t('pages.dashboard.statementPdf.totalExpenses'),
          netBalance: t('pages.dashboard.statementPdf.netBalance'),
          surplus: t('pages.dashboard.statementPdf.surplus'),
          deficit: t('pages.dashboard.statementPdf.deficit'),
          releaseCount: (count: number) =>
            `${count} ${
              count === 1
                ? t('pages.dashboard.statementPdf.release_one')
                : t('pages.dashboard.statementPdf.release_other')
            }`,
          accountBalances: t('pages.dashboard.statementPdf.accountBalances'),
          transactions: t('pages.dashboard.statementPdf.transactions'),
          colDate: t('pages.dashboard.statementPdf.colDate'),
          colDescription: t('pages.dashboard.statementPdf.colDescription'),
          colCategory: t('pages.dashboard.statementPdf.colCategory'),
          colAccount: t('pages.dashboard.statementPdf.colAccount'),
          colValue: t('pages.dashboard.statementPdf.colValue'),
          noTransactions: t('pages.dashboard.statementPdf.noTransactions'),
          periodBalance: t('pages.dashboard.statementPdf.periodBalance'),
          footer: t('pages.dashboard.statementPdf.footer'),
          page: t('pages.dashboard.statementPdf.page'),
          of: t('pages.dashboard.statementPdf.of'),
        };

        const data: StatementData = {
          period: {
            from: formatPeriodLabel(dateFrom),
            to: formatPeriodLabel(dateTo),
          },
          generatedAt: formatGeneratedAt(),
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
          labels,
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
    [user, t, i18n.language]
  );

  return { isGenerating, generateStatement };
}
