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
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useChartColors } from '@/lib/chart-colors';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
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

type ActiveTab =
  | 'expenses'
  | 'revenues'
  | 'loans_benefited'
  | 'loans_creditor'
  | 'payables'
  | 'transfers';

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
  const [activeTab, setActiveTab] = useState<ActiveTab>('expenses');

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

  const netBalanceValue = parseFloat(summary.net_balance);
  const isNetPositive = netBalanceValue >= 0;

  const totalRevenues = parseFloat(summary.total_revenues);
  const totalExpenses = parseFloat(summary.total_expenses);
  const revenuesPlusExpenses = totalRevenues + totalExpenses;

  const pieData = expenses_by_category
    .filter((item) => parseFloat(item.total) > 0)
    .map((item) => ({
      name: EXPENSE_CATEGORY_LABELS[item.category] ?? item.category,
      value: parseFloat(item.total),
    }));

  const tabs: { key: ActiveTab; label: string; count: number; icon: ReactNode }[] = [
    {
      key: 'expenses',
      label: 'Despesas',
      count: report.expenses.length,
      icon: <TrendingDown className="h-4 w-4" />,
    },
    {
      key: 'revenues',
      label: 'Receitas',
      count: report.revenues.length,
      icon: <TrendingUp className="h-4 w-4" />,
    },
    {
      key: 'loans_benefited',
      label: 'Emp. Recebidos',
      count: report.loans_as_benefited.length,
      icon: <HandCoins className="h-4 w-4" />,
    },
    {
      key: 'loans_creditor',
      label: 'Emp. Concedidos',
      count: report.loans_as_creditor.length,
      icon: <HandCoins className="h-4 w-4" />,
    },
    {
      key: 'payables',
      label: 'A Pagar',
      count: report.payables.length,
      icon: <Receipt className="h-4 w-4" />,
    },
    {
      key: 'transfers',
      label: 'Transferências',
      count: report.transfers.length,
      icon: <ArrowLeftRight className="h-4 w-4" />,
    },
  ];

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
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Membros
        </Button>
      </div>

      {/* Member identity header */}
      <div className="mb-6 overflow-hidden rounded-xl border bg-gradient-to-r from-primary/10 via-transparent to-transparent p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {report.member.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{report.member.name}</h2>
            <p className="text-sm text-muted-foreground">Relatório financeiro</p>
            {appliedStart && appliedEnd && (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(appliedStart)} a {formatDate(appliedEnd)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Date Filters */}
      <div className="mb-lg flex flex-wrap items-end gap-md rounded-lg border bg-card p-md">
        <div className="flex flex-col gap-xs">
          <Label htmlFor="start-date">Data Inicial</Label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="flex flex-col gap-xs">
          <Label htmlFor="end-date">Data Final</Label>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-44"
          />
        </div>
        <Button
          onClick={() => {
            setAppliedStart(startDate);
            setAppliedEnd(endDate);
          }}
          variant="outline"
        >
          Aplicar Filtro
        </Button>
        {(appliedStart || appliedEnd) && (
          <Button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setAppliedStart('');
              setAppliedEnd('');
            }}
            variant="ghost"
          >
            Limpar
          </Button>
        )}
      </div>

      {/* Net balance hero */}
      <div className="mb-4 rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Saldo líquido do período</p>
        <p
          className={cn(
            'text-3xl font-bold',
            isNetPositive ? 'text-success' : 'text-destructive'
          )}
        >
          {isNetPositive ? '+' : ''}
          {formatCurrency(summary.net_balance)}
        </p>
        {revenuesPlusExpenses > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="bg-success"
                style={{
                  width: `${(totalRevenues / revenuesPlusExpenses) * 100}%`,
                }}
              />
              <div
                className="bg-destructive"
                style={{
                  width: `${(totalExpenses / revenuesPlusExpenses) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="text-success">
                Receitas: {formatCurrency(summary.total_revenues)}
              </span>
              <span className="text-destructive">
                Despesas: {formatCurrency(summary.total_expenses)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="mb-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
        <div className="overflow-hidden rounded-lg border-t-2 border-t-success">
          <StatCard
            title="Receitas"
            value={formatCurrency(summary.total_revenues)}
            icon={<TrendingUp className="h-5 w-5 text-success" />}
            variant="success"
          />
        </div>
        <div className="overflow-hidden rounded-lg border-t-2 border-t-destructive">
          <StatCard
            title="Despesas"
            value={formatCurrency(summary.total_expenses)}
            icon={<TrendingDown className="h-5 w-5 text-destructive" />}
            variant="danger"
          />
        </div>
        <div className="overflow-hidden rounded-lg border-t-2 border-t-warning">
          <StatCard
            title="Valores a Pagar"
            value={formatCurrency(summary.total_payables)}
            icon={<Receipt className="h-5 w-5 text-warning" />}
            variant="warning"
          />
        </div>
        <div
          className={cn(
            'overflow-hidden rounded-lg border-t-2',
            isNetPositive ? 'border-t-success' : 'border-t-destructive'
          )}
        >
          <StatCard
            title="Saldo Líquido"
            value={formatCurrency(summary.net_balance)}
            icon={
              isNetPositive ? (
                <TrendingUp className="h-5 w-5 text-success" />
              ) : (
                <TrendingDown className="h-5 w-5 text-destructive" />
              )
            }
            variant={isNetPositive ? 'success' : 'danger'}
          />
        </div>
      </div>

      <div className="mb-lg grid grid-cols-1 gap-md sm:grid-cols-3">
        <StatCard
          title="Empréstimos Recebidos"
          value={formatCurrency(summary.total_loans_as_benefited)}
          icon={<HandCoins className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          title="Empréstimos Concedidos"
          value={formatCurrency(summary.total_loans_as_creditor)}
          icon={<HandCoins className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          title="Transferências"
          value={formatCurrency(summary.total_transfers)}
          icon={<ArrowLeftRight className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      {/* Expense Pie Chart */}
      {pieData.length > 0 && (
        <div className="mb-lg overflow-hidden rounded-lg border bg-card p-md">
          <h3 className="mb-md text-base font-semibold">Despesas por Categoria</h3>
          <ChartContainer
            chartId="member-expenses-by-category"
            data={pieData}
            dataKey="value"
            nameKey="name"
            formatter={(value) => formatCurrency(value.toString())}
            colors={chartColors}
            emptyMessage="Sem despesas por categoria"
            lockChartType="pie"
            height={300}
          />
        </div>
      )}

      {/* Transaction Tabs */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap gap-0 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-md py-sm text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
              <Badge variant="secondary" className="text-xs">
                {tab.count}
              </Badge>
            </button>
          ))}
        </div>

        <div className="custom-scrollbar overflow-x-auto">
          {activeTab === 'expenses' && <ExpensesTable items={report.expenses} />}
          {activeTab === 'revenues' && <RevenuesTable items={report.revenues} />}
          {activeTab === 'loans_benefited' && (
            <LoansTable
              items={report.loans_as_benefited}
              counterpartLabel="Credor"
              counterpartKey="creditor"
            />
          )}
          {activeTab === 'loans_creditor' && (
            <LoansTable
              items={report.loans_as_creditor}
              counterpartLabel="Beneficiado"
              counterpartKey="benefited"
            />
          )}
          {activeTab === 'payables' && <PayablesTable items={report.payables} />}
          {activeTab === 'transfers' && <TransfersTable items={report.transfers} />}
        </div>
      </div>
    </PageContainer>
  );
}

// ─── Shared table sub-components ──────────────────────────────────────────────

function EmptyRows() {
  return (
    <tr>
      <td colSpan={99} className="px-6 py-8 text-center text-sm text-muted-foreground">
        Nenhum registro encontrado
      </td>
    </tr>
  );
}

function TableWrapper({ children }: { children: ReactNode }) {
  return <table className="w-full">{children}</table>;
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-6 py-4 text-left text-sm font-semibold">{children}</th>;
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-6 py-4 text-sm ${className}`}>{children}</td>;
}

// ─── Table variants ────────────────────────────────────────────────────────────

function ExpensesTable({ items }: { items: MemberReportExpense[] }) {
  return (
    <TableWrapper>
      <thead className="border-b bg-muted/50">
        <tr>
          <Th>Descrição</Th>
          <Th>Valor</Th>
          <Th>Data</Th>
          <Th>Categoria</Th>
          <Th>Estabelecimento</Th>
          <Th>Status</Th>
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
                  {item.payed ? 'Pago' : 'Pendente'}
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
  return (
    <TableWrapper>
      <thead className="border-b bg-muted/50">
        <tr>
          <Th>Descrição</Th>
          <Th>Valor</Th>
          <Th>Data</Th>
          <Th>Categoria</Th>
          <Th>Fonte</Th>
          <Th>Status</Th>
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
                  {item.received ? 'Recebido' : 'Pendente'}
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
  return (
    <TableWrapper>
      <thead className="border-b bg-muted/50">
        <tr>
          <Th>Descrição</Th>
          <Th>Valor</Th>
          <Th>Valor Pago</Th>
          <Th>Data</Th>
          <Th>{counterpartLabel}</Th>
          <Th>Status</Th>
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
  return (
    <TableWrapper>
      <thead className="border-b bg-muted/50">
        <tr>
          <Th>Descrição</Th>
          <Th>Valor Total</Th>
          <Th>Valor Pago</Th>
          <Th>Data</Th>
          <Th>Vencimento</Th>
          <Th>Status</Th>
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
  return (
    <TableWrapper>
      <thead className="border-b bg-muted/50">
        <tr>
          <Th>Descrição</Th>
          <Th>Valor</Th>
          <Th>Data</Th>
          <Th>Tipo</Th>
          <Th>Status</Th>
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
                  {item.transfered ? 'Realizado' : 'Pendente'}
                </Badge>
              </Td>
            </tr>
          ))
        )}
      </tbody>
    </TableWrapper>
  );
}
