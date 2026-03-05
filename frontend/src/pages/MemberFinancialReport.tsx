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
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

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

export default function MemberFinancialReport() {
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('expenses');

  const memberId = Number(id);

  const loadReport = useCallback(async () => {
    if (!memberId) return;
    try {
      setIsLoading(true);
      const data = await membersService.getFinancialReport(memberId, {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
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
  }, [memberId, startDate, endDate, toast, t]);

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

  const pieData = expenses_by_category
    .filter((item) => parseFloat(item.total) > 0)
    .map((item) => ({
      name: EXPENSE_CATEGORY_LABELS[item.category] ?? item.category,
      value: parseFloat(item.total),
    }));

  const tabs: { key: ActiveTab; label: string; count: number }[] = [
    { key: 'expenses', label: 'Despesas', count: report.expenses.length },
    { key: 'revenues', label: 'Receitas', count: report.revenues.length },
    {
      key: 'loans_benefited',
      label: 'Emp. Recebidos',
      count: report.loans_as_benefited.length,
    },
    {
      key: 'loans_creditor',
      label: 'Emp. Concedidos',
      count: report.loans_as_creditor.length,
    },
    { key: 'payables', label: 'A Pagar', count: report.payables.length },
    { key: 'transfers', label: 'Transferências', count: report.transfers.length },
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
        <Button onClick={() => void loadReport()} variant="outline">
          Aplicar Filtro
        </Button>
        {(startDate || endDate) && (
          <Button
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            variant="ghost"
          >
            Limpar
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="mb-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Receitas"
          value={`R$ ${summary.total_revenues}`}
          icon={<TrendingUp className="h-5 w-5 text-success" />}
          variant="success"
        />
        <StatCard
          title="Despesas"
          value={`R$ ${summary.total_expenses}`}
          icon={<TrendingDown className="h-5 w-5 text-destructive" />}
          variant="danger"
        />
        <StatCard
          title="Valores a Pagar"
          value={`R$ ${summary.total_payables}`}
          icon={<Receipt className="h-5 w-5 text-warning" />}
          variant="warning"
        />
        <StatCard
          title="Saldo Líquido"
          value={`R$ ${summary.net_balance}`}
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

      <div className="mb-lg grid grid-cols-1 gap-md sm:grid-cols-3">
        <StatCard
          title="Empréstimos Recebidos"
          value={`R$ ${summary.total_loans_as_benefited}`}
          icon={<HandCoins className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          title="Empréstimos Concedidos"
          value={`R$ ${summary.total_loans_as_creditor}`}
          icon={<HandCoins className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          title="Transferências"
          value={`R$ ${summary.total_transfers}`}
          icon={<ArrowLeftRight className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      {/* Expense Pie Chart */}
      {pieData.length > 0 && (
        <div className="mb-lg overflow-hidden rounded-lg border bg-card p-md">
          <h3 className="mb-md text-base font-semibold">Despesas por Categoria</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={110} dataKey="value">
                {pieData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={chartColors[index % chartColors.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value.toString())}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
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
