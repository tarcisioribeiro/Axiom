/* eslint-disable max-lines */
import {
  ArrowLeft,
  Download,
  TrendingUp,
  TrendingDown,
  Receipt,
  HandCoins,
  ArrowLeftRight,
  BarChart3,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { ChartContainer } from '@/components/charts';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useChartColors } from '@/lib/chart-colors';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/utils';
import { membersService } from '@/services/members-service';
import type {
  MemberFinancialReport,
  MemberReportExpense,
  MemberReportLoan,
  MemberReportPayable,
  MemberReportRevenue,
  MemberReportTransfer,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  'food and drink': 'Comida e bebida',
  'bills and services': 'Contas e serviços',
  electronics: 'Eletrônicos',
  'family and friends': 'Amizades e Família',
  pets: 'Animais de estimação',
  'digital signs': 'Assinaturas digitais',
  house: 'Casa',
  purchases: 'Compras',
  donate: 'Doações',
  education: 'Educação',
  loans: 'Empréstimos',
  entertainment: 'Entretenimento',
  taxes: 'Impostos',
  investments: 'Investimentos',
  others: 'Outros',
  vestuary: 'Roupas',
  'health and care': 'Saúde e cuidados pessoais',
  'professional services': 'Serviços profissionais',
  supermarket: 'Supermercado',
  rates: 'Taxas',
  transport: 'Transporte',
  travels: 'Viagens',
};

const LOAN_STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  paid: 'Quitado',
  overdue: 'Em atraso',
  cancelled: 'Cancelado',
  renegotiated: 'Renegociado',
};

const PAYABLE_STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  paid: 'Quitado',
  overdue: 'Em atraso',
  cancelled: 'Cancelado',
};

export default function MemberFinancialReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const chartColors = useChartColors();

  const [report, setReport] = useState<MemberFinancialReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');
  const memberId = Number(id);

  const loadReport = useCallback(async () => {
    if (!memberId) return;
    try {
      setIsLoading(true);
      const data = await membersService.getFinancialReport(memberId, {
        start_date: appliedStart || undefined,
        end_date: appliedEnd || undefined,
      });
      setReport(data);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [memberId, appliedStart, appliedEnd, toast, t]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleExportCsv = async () => {
    if (!memberId) return;
    try {
      setIsExporting(true);
      await membersService.exportFinancialReportCsv(memberId, {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao exportar',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <LoadingState />;
  if (!report) return null;

  const { summary, expenses_by_category } = report;

  const pieData = expenses_by_category
    .filter((item) => parseFloat(item.total) > 0)
    .map((item) => ({
      name: EXPENSE_CATEGORY_LABELS[item.category] ?? item.category,
      value: parseFloat(item.total),
    }));

  return (
    <PageContainer>
      <PageHeader
        title={`Relatório Financeiro: ${report.member.name}`}
        icon={<BarChart3 />}
        action={{
          label: isExporting ? 'Exportando...' : 'Exportar CSV',
          icon: <Download className="h-4 w-4" />,
          onClick: () => void handleExportCsv(),
        }}
      />

      <div className="mb-md">
        <Button variant="ghost" size="sm" onClick={() => navigate('/members')}>
          <ArrowLeft className="mr-sm h-4 w-4" />
          Voltar para Membros
        </Button>
      </div>

      {/* Member identity header */}
      <div className="mb-lg overflow-hidden rounded-lg border bg-gradient-to-r from-primary/10 via-transparent to-transparent p-lg">
        <div className="flex items-center gap-md">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {report.member.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{report.member.name}</h2>
            <p className="text-sm text-muted-foreground">
              {t('pages.memberFinancialReport.subtitle')}
            </p>
            {appliedStart && appliedEnd && (
              <p className="mt-xs text-xs text-muted-foreground">
                {formatDate(appliedStart)} a {formatDate(appliedEnd)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Date Filters */}
      <FilterBar
        hasActiveFilters={!!(appliedStart || appliedEnd)}
        onClear={() => {
          setStartDate('');
          setEndDate('');
          setAppliedStart('');
          setAppliedEnd('');
        }}
        className="mb-lg"
      >
        <div className="flex flex-wrap items-end gap-sm">
          <div className="flex flex-col gap-xs">
            <Label htmlFor="start-date" className="text-xs">
              Data Inicial
            </Label>
            <DatePicker
              value={startDate}
              onChange={(date) => setStartDate(date ? formatLocalDate(date) : '')}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-xs">
            <Label htmlFor="end-date" className="text-xs">
              Data Final
            </Label>
            <DatePicker
              value={endDate}
              onChange={(date) => setEndDate(date ? formatLocalDate(date) : '')}
              className="w-40"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAppliedStart(startDate);
              setAppliedEnd(endDate);
            }}
          >
            Aplicar
          </Button>
        </div>
      </FilterBar>

      {/* Summary Cards */}
      <div className="mb-lg grid grid-cols-1 gap-md sm:grid-cols-3">
        <div className="overflow-hidden rounded-lg border-t-2 border-t-success">
          <StatCard
            title={t('pages.memberFinancialReport.revenues')}
            value={formatCurrency(summary.total_revenues)}
            icon={<TrendingUp className="h-5 w-5 text-success" />}
            variant="success"
          />
        </div>
        <div className="overflow-hidden rounded-lg border-t-2 border-t-destructive">
          <StatCard
            title={t('pages.memberFinancialReport.expenses')}
            value={formatCurrency(summary.total_expenses)}
            icon={<TrendingDown className="h-5 w-5 text-destructive" />}
            variant="danger"
          />
        </div>
        <div className="overflow-hidden rounded-lg border-t-2 border-t-warning">
          <StatCard
            title={t('pages.memberFinancialReport.payables')}
            value={formatCurrency(summary.total_payables)}
            icon={<Receipt className="h-5 w-5 text-warning" />}
            variant="warning"
          />
        </div>
      </div>

      <div className="mb-lg grid grid-cols-1 gap-md sm:grid-cols-3">
        <StatCard
          title={t('pages.memberFinancialReport.loansReceived')}
          value={formatCurrency(summary.total_loans_as_benefited)}
          icon={<HandCoins className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          title={t('pages.memberFinancialReport.loansGranted')}
          value={formatCurrency(summary.total_loans_as_creditor)}
          icon={<HandCoins className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          title={t('pages.memberFinancialReport.transfers')}
          value={formatCurrency(summary.total_transfers)}
          icon={<ArrowLeftRight className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      {/* Expense Pie Chart */}
      {pieData.length > 0 && (
        <div className="mb-lg overflow-hidden rounded-lg border bg-card p-md">
          <h3 className="mb-md text-base font-semibold">
            {t('pages.memberFinancialReport.expensesByCategory')}
          </h3>
          <ChartContainer
            chartId="member-expenses-by-category"
            data={pieData}
            dataKey="value"
            nameKey="name"
            formatter={(value) => formatCurrency(value.toString())}
            colors={chartColors}
            emptyMessage={t('pages.memberFinancialReport.noExpensesByCategory')}
            lockChartType="pie"
            height={300}
          />
        </div>
      )}

      {/* Transaction Tabs */}
      <Tabs defaultValue="expenses" className="flex flex-1 flex-col">
        <TabsList className="mb-lg w-full">
          <TabsTrigger value="expenses" className="flex-1 gap-xs">
            <TrendingDown className="h-4 w-4" />
            Despesas
            <Badge variant="secondary" className="text-xs">
              {report.expenses.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="revenues" className="flex-1 gap-xs">
            <TrendingUp className="h-4 w-4" />
            Receitas
            <Badge variant="secondary" className="text-xs">
              {report.revenues.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="loans_benefited" className="flex-1 gap-xs">
            <HandCoins className="h-4 w-4" />
            Emp. Recebidos
            <Badge variant="secondary" className="text-xs">
              {report.loans_as_benefited.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="loans_creditor" className="flex-1 gap-xs">
            <HandCoins className="h-4 w-4" />
            Emp. Concedidos
            <Badge variant="secondary" className="text-xs">
              {report.loans_as_creditor.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="payables" className="flex-1 gap-xs">
            <Receipt className="h-4 w-4" />A Pagar
            <Badge variant="secondary" className="text-xs">
              {report.payables.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="transfers" className="flex-1 gap-xs">
            <ArrowLeftRight className="h-4 w-4" />
            Transferências
            <Badge variant="secondary" className="text-xs">
              {report.transfers.length}
            </Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="expenses" className="mt-0 flex-1">
          <div className="custom-scrollbar overflow-x-auto">
            <ExpensesTable items={report.expenses} />
          </div>
        </TabsContent>
        <TabsContent value="revenues" className="mt-0 flex-1">
          <div className="custom-scrollbar overflow-x-auto">
            <RevenuesTable items={report.revenues} />
          </div>
        </TabsContent>
        <TabsContent value="loans_benefited" className="mt-0 flex-1">
          <div className="custom-scrollbar overflow-x-auto">
            <LoansTable
              items={report.loans_as_benefited}
              counterpartLabel={t('pages.memberFinancialReport.creditor')}
              counterpartKey="creditor"
            />
          </div>
        </TabsContent>
        <TabsContent value="loans_creditor" className="mt-0 flex-1">
          <div className="custom-scrollbar overflow-x-auto">
            <LoansTable
              items={report.loans_as_creditor}
              counterpartLabel={t('pages.memberFinancialReport.benefited')}
              counterpartKey="benefited"
            />
          </div>
        </TabsContent>
        <TabsContent value="payables" className="mt-0 flex-1">
          <div className="custom-scrollbar overflow-x-auto">
            <PayablesTable items={report.payables} />
          </div>
        </TabsContent>
        <TabsContent value="transfers" className="mt-0 flex-1">
          <div className="custom-scrollbar overflow-x-auto">
            <TransfersTable items={report.transfers} />
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

// ─── Shared table sub-components ──────────────────────────────────────────────

function EmptyRows() {
  return (
    <tr>
      <td
        colSpan={99}
        className="px-lg py-xl text-center text-sm text-muted-foreground"
      >
        Nenhum registro encontrado
      </td>
    </tr>
  );
}

function TableWrapper({ children }: { children: ReactNode }) {
  return <table className="w-full">{children}</table>;
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-lg py-md text-left text-sm font-semibold">{children}</th>;
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-lg py-md text-sm ${className}`}>{children}</td>;
}

// ─── Table variants ────────────────────────────────────────────────────────────

function ExpensesTable({ items }: { items: MemberReportExpense[] }) {
  const { t } = useTranslation();
  return (
    <TableWrapper>
      <thead className="border-b bg-muted/50">
        <tr>
          <Th>{t('common.fields.description')}</Th>
          <Th>{t('common.fields.amount')}</Th>
          <Th>{t('common.fields.date')}</Th>
          <Th>{t('common.fields.category')}</Th>
          <Th>{t('common.fields.merchant')}</Th>
          <Th>{t('common.fields.status')}</Th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {items.length === 0 ? (
          <EmptyRows />
        ) : (
          items.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-muted/30">
              <Td>{item.description}</Td>
              <Td className="font-medium text-destructive">
                {formatCurrency(item.value)}
              </Td>
              <Td>{formatDate(item.date)}</Td>
              <Td>{EXPENSE_CATEGORY_LABELS[item.category] ?? item.category}</Td>
              <Td className="text-muted-foreground">{item.merchant || '—'}</Td>
              <Td>
                <Badge variant={item.payed ? 'default' : 'outline'}>
                  {item.payed ? t('common.status.paid') : t('common.status.pending')}
                </Badge>
              </Td>
            </tr>
          ))
        )}
      </tbody>
    </TableWrapper>
  );
}

function RevenuesTable({ items }: { items: MemberReportRevenue[] }) {
  const { t } = useTranslation();
  return (
    <TableWrapper>
      <thead className="border-b bg-muted/50">
        <tr>
          <Th>{t('common.fields.description')}</Th>
          <Th>{t('common.fields.amount')}</Th>
          <Th>{t('common.fields.date')}</Th>
          <Th>{t('common.fields.category')}</Th>
          <Th>{t('common.fields.source')}</Th>
          <Th>{t('common.fields.status')}</Th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {items.length === 0 ? (
          <EmptyRows />
        ) : (
          items.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-muted/30">
              <Td>{item.description}</Td>
              <Td className="font-medium text-success">{formatCurrency(item.value)}</Td>
              <Td>{formatDate(item.date)}</Td>
              <Td>{item.category}</Td>
              <Td className="text-muted-foreground">{item.source || '—'}</Td>
              <Td>
                <Badge variant={item.received ? 'default' : 'outline'}>
                  {item.received
                    ? t('common.fields.received')
                    : t('common.status.pending')}
                </Badge>
              </Td>
            </tr>
          ))
        )}
      </tbody>
    </TableWrapper>
  );
}

function LoansTable({
  items,
  counterpartLabel,
  counterpartKey,
}: {
  items: MemberReportLoan[];
  counterpartLabel: string;
  counterpartKey: 'creditor' | 'benefited';
}) {
  const { t } = useTranslation();
  return (
    <TableWrapper>
      <thead className="border-b bg-muted/50">
        <tr>
          <Th>{t('common.fields.description')}</Th>
          <Th>{t('common.fields.amount')}</Th>
          <Th>{t('pages.memberFinancialReport.paidAmount')}</Th>
          <Th>{t('common.fields.date')}</Th>
          <Th>{counterpartLabel}</Th>
          <Th>{t('common.fields.status')}</Th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {items.length === 0 ? (
          <EmptyRows />
        ) : (
          items.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-muted/30">
              <Td>{item.description}</Td>
              <Td className="font-medium">{formatCurrency(item.value)}</Td>
              <Td>{formatCurrency(item.payed_value)}</Td>
              <Td>{formatDate(item.date)}</Td>
              <Td>{item[counterpartKey] ?? '—'}</Td>
              <Td>
                <Badge variant={item.status === 'paid' ? 'default' : 'outline'}>
                  {LOAN_STATUS_LABELS[item.status] ?? item.status}
                </Badge>
              </Td>
            </tr>
          ))
        )}
      </tbody>
    </TableWrapper>
  );
}

function PayablesTable({ items }: { items: MemberReportPayable[] }) {
  const { t } = useTranslation();
  return (
    <TableWrapper>
      <thead className="border-b bg-muted/50">
        <tr>
          <Th>{t('common.fields.description')}</Th>
          <Th>{t('pages.memberFinancialReport.totalAmount')}</Th>
          <Th>{t('pages.memberFinancialReport.paidAmount')}</Th>
          <Th>{t('common.fields.date')}</Th>
          <Th>{t('pages.memberFinancialReport.dueDate')}</Th>
          <Th>{t('common.fields.status')}</Th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {items.length === 0 ? (
          <EmptyRows />
        ) : (
          items.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-muted/30">
              <Td>{item.description}</Td>
              <Td className="font-medium">{formatCurrency(item.value)}</Td>
              <Td>{formatCurrency(item.paid_value)}</Td>
              <Td>{formatDate(item.date)}</Td>
              <Td>{item.due_date ? formatDate(item.due_date) : '—'}</Td>
              <Td>
                <Badge
                  variant={
                    item.status === 'paid'
                      ? 'default'
                      : item.status === 'overdue'
                        ? 'destructive'
                        : 'outline'
                  }
                >
                  {PAYABLE_STATUS_LABELS[item.status] ?? item.status}
                </Badge>
              </Td>
            </tr>
          ))
        )}
      </tbody>
    </TableWrapper>
  );
}

function TransfersTable({ items }: { items: MemberReportTransfer[] }) {
  const { t } = useTranslation();
  return (
    <TableWrapper>
      <thead className="border-b bg-muted/50">
        <tr>
          <Th>{t('common.fields.description')}</Th>
          <Th>{t('common.fields.amount')}</Th>
          <Th>{t('common.fields.date')}</Th>
          <Th>{t('common.fields.type')}</Th>
          <Th>{t('common.fields.status')}</Th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {items.length === 0 ? (
          <EmptyRows />
        ) : (
          items.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-muted/30">
              <Td>{item.description}</Td>
              <Td className="font-medium">{formatCurrency(item.value)}</Td>
              <Td>{formatDate(item.date)}</Td>
              <Td>{item.category.toUpperCase()}</Td>
              <Td>
                <Badge variant={item.transfered ? 'default' : 'outline'}>
                  {item.transfered
                    ? t('common.status.completed')
                    : t('common.status.pending')}
                </Badge>
              </Td>
            </tr>
          ))
        )}
      </tbody>
    </TableWrapper>
  );
}
