/* eslint-disable max-lines */
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BadgePercent,
  CalendarDays,
  Check,
  Clock,
  FileText,
  Loader2,
  Shield,
  Tag,
  Users,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';
import { FileInput } from '@/components/ui/file-input';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TimePicker } from '@/components/ui/time-picker';
import { EXPENSE_CATEGORIES_CANONICAL, translate } from '@/config/constants';
import { EXPENSE_CATEGORY_ICONS } from '@/config/icons';
import { formatCurrency } from '@/lib/formatters';
import { getAccountBalanceInfo } from '@/lib/helpers';
import { formatLocalDate } from '@/lib/utils';
import type { Account, Loan, LoanFormData, Member } from '@/types';

const PAYMENT_FREQUENCIES = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'bimonthly',
  'quarterly',
  'semiannual',
  'annual',
];
const LOAN_STATUSES = ['active', 'paid', 'defaulted', 'cancelled'];

interface LoanFormProps {
  loan: Loan | undefined;
  accounts: Account[];
  members: Member[];
  currentUserMemberId?: number | null;
  onSubmit: (data: LoanFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function LoanForm({
  loan,
  accounts,
  members,
  currentUserMemberId,
  onSubmit,
  onCancel,
  isLoading,
}: LoanFormProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const [formData, setFormData] = useState<LoanFormData>(() =>
    loan
      ? {
          description: loan.description,
          value: parseFloat(loan.value),
          payed_value: parseFloat(loan.payed_value),
          date: loan.date,
          horary: loan.horary,
          category: loan.category,
          account: loan.account,
          benefited: loan.benefited,
          creditor: loan.creditor,
          payed: loan.payed,
          interest_rate: loan.interest_rate
            ? parseFloat(loan.interest_rate)
            : undefined,
          installments: loan.installments,
          due_date: loan.due_date,
          payment_frequency: loan.payment_frequency,
          late_fee: parseFloat(loan.late_fee),
          guarantor: loan.guarantor,
          notes: loan.notes,
          status: loan.status,
          loan_type: undefined,
          generate_revenue: false,
          generate_expense: false,
        }
      : {
          description: '',
          value: 0,
          payed_value: 0,
          date: formatLocalDate(new Date()),
          horary: new Date().toTimeString().slice(0, 5),
          category: 'loans',
          account: accounts[0]?.id ?? 0,
          benefited: currentUserMemberId ?? members[0]?.id ?? 0,
          creditor:
            members.find((m) => m.id !== currentUserMemberId)?.id ??
            members[0]?.id ??
            0,
          payed: false,
          installments: 1,
          payment_frequency: 'monthly',
          late_fee: 0,
          status: 'active',
          loan_type: 'borrowed',
          generate_revenue: false,
          generate_expense: false,
        }
  );

  const set = (patch: Partial<LoanFormData>) =>
    setFormData((prev) => ({ ...prev, ...patch }));

  const isEditing = !!loan;

  const eligibleCreditors = useMemo(
    () =>
      members.filter(
        (m) => m.is_creditor && (!currentUserMemberId || m.id !== currentUserMemberId)
      ),
    [members, currentUserMemberId]
  );
  const eligibleBeneficiaries = useMemo(
    () =>
      members.filter(
        (m) =>
          (m.is_benefited || !m.is_creditor) &&
          (!currentUserMemberId || m.id !== currentUserMemberId)
      ),
    [members, currentUserMemberId]
  );

  const balanceInfo = useMemo(() => {
    if (isEditing) return null;
    if (formData.loan_type !== 'lent' || !formData.generate_expense) return null;
    if (!formData.account || formData.value <= 0) return null;
    const account = accounts.find((a) => a.id === formData.account);
    if (!account) return null;
    return getAccountBalanceInfo(account, formData.value);
  }, [
    isEditing,
    formData.loan_type,
    formData.generate_expense,
    formData.account,
    formData.value,
    accounts,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < totalSteps && !isEditing) {
      setStep((s) => s + 1);
      return;
    }
    if (balanceInfo && !balanceInfo.canPay) return;
    onSubmit(formData);
  };

  const stepLabels = [
    t('pages.loans.wizard.step1'),
    t('pages.loans.wizard.step2'),
    t('pages.loans.wizard.step3'),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-lg">
      {/* Barra de progresso do wizard (apenas na criação) */}
      {!isEditing && (
        <div className="space-y-sm">
          <div className="flex items-center justify-between">
            {stepLabels.map((label, i) => {
              const stepNum = i + 1;
              const isActive = stepNum === step;
              const isDone = stepNum < step;
              return (
                <div key={stepNum} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-xs">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors ${
                        isDone
                          ? 'border-primary bg-primary text-primary-foreground'
                          : isActive
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/50 bg-muted/30 text-muted-foreground'
                      }`}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5" /> : stepNum}
                    </div>
                    <span
                      className={`text-center text-xs ${isActive ? 'font-semibold text-primary' : 'text-muted-foreground'}`}
                    >
                      {label}
                    </span>
                  </div>
                  {i < totalSteps - 1 && (
                    <div
                      className={`mx-xs h-0.5 flex-1 transition-colors ${isDone ? 'bg-primary' : 'bg-border/50'}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Etapa 1 (ou modo edição completo): Tipo & Valor */}
      {(step === 1 || isEditing) && (
        <FormSection
          title={
            isEditing
              ? t('common.form.sections.basicInfo')
              : t('pages.loans.wizard.step1')
          }
          icon={FileText}
        >
          <div className="grid grid-cols-2 gap-md">
            {!isEditing && (
              <div className="col-span-2">
                <Label className="flex items-center gap-xs">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('pages.loans.form.loanTypeLabel')}
                </Label>
                <div className="mt-sm grid grid-cols-2 gap-sm">
                  {(['borrowed', 'lent'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        set({
                          loan_type: type,
                          generate_revenue: false,
                          generate_expense: false,
                          ...(type === 'borrowed' && currentUserMemberId
                            ? {
                                benefited: currentUserMemberId,
                                creditor: eligibleCreditors[0]?.id ?? 0,
                              }
                            : {}),
                          ...(type === 'lent' && currentUserMemberId
                            ? {
                                creditor: currentUserMemberId,
                                benefited: eligibleBeneficiaries[0]?.id ?? 0,
                              }
                            : {}),
                        });
                      }}
                      className={`flex flex-col items-center gap-sm rounded-lg border-2 p-md transition-all ${
                        formData.loan_type === type
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/50 bg-muted/10 text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      {type === 'borrowed' ? (
                        <ArrowDownToLine className="h-6 w-6" />
                      ) : (
                        <ArrowUpFromLine className="h-6 w-6" />
                      )}
                      <span className="text-sm font-medium">
                        {t(`pages.loans.form.${type}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="col-span-2">
              <Label htmlFor="description" className="flex items-center gap-xs">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.descriptionLabel')}
              </Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => set({ description: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="value" className="flex items-center gap-xs">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.totalValueLabel')}
              </Label>
              <CurrencyInput
                id="value"
                value={formData.value}
                onChange={(e) => set({ value: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label htmlFor="payed_value" className="flex items-center gap-xs">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.paidValueLabel')}
                {loan ? ` ${t('pages.loans.form.paidValueCalculated')}` : ' *'}
              </Label>
              <CurrencyInput
                id="payed_value"
                value={formData.payed_value}
                onChange={(e) => set({ payed_value: parseFloat(e.target.value) || 0 })}
                disabled={!!loan}
                className={loan ? 'cursor-not-allowed bg-muted' : ''}
              />
              {loan && (
                <p className="mt-xs text-xs text-muted-foreground">
                  {t('pages.loans.form.paidValueNote')}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="date" className="flex items-center gap-xs">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.dateLabel')}
              </Label>
              <DatePicker
                value={formData.date ?? undefined}
                onChange={(date) => set({ date: date ? formatLocalDate(date) : '' })}
                placeholder={t('pages.loans.form.datePlaceholder')}
              />
            </div>

            <div>
              <Label htmlFor="horary" className="flex items-center gap-xs">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.timeLabel')}
              </Label>
              <TimePicker
                value={formData.horary || undefined}
                onChange={(t) => set({ horary: t ?? '' })}
              />
            </div>
          </div>
        </FormSection>
      )}

      {/* Etapa 2: Partes & Conta */}
      {(step === 2 || isEditing) && (
        <FormSection
          title={
            isEditing
              ? t('common.form.sections.parties')
              : t('pages.loans.wizard.step2')
          }
          icon={Users}
        >
          <div className="grid grid-cols-2 gap-md">
            <div>
              <Label htmlFor="category" className="flex items-center gap-xs">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.categoryLabel')}
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => set({ category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES_CANONICAL.map(({ key }) => {
                    const Icon = EXPENSE_CATEGORY_ICONS[key];
                    return (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          {Icon && (
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          {translate('expenseCategories', key)}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="account" className="flex items-center gap-xs">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.accountLabel')}
              </Label>
              <Select
                value={formData.account.toString()}
                onValueChange={(value) => set({ account: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      {acc.account_name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {parseFloat(acc.balance).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {((!isEditing && formData.loan_type === 'lent') || isEditing) && (
              <div>
                <Label htmlFor="benefited" className="flex items-center gap-xs">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('pages.loans.form.benefitedLabel')}
                </Label>
                <Select
                  value={formData.benefited.toString()}
                  onValueChange={(value) => set({ benefited: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(isEditing
                      ? members.filter(
                          (m) => !currentUserMemberId || m.id !== currentUserMemberId
                        )
                      : eligibleBeneficiaries
                    ).map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {((!isEditing && formData.loan_type === 'borrowed') || isEditing) && (
              <div>
                <Label htmlFor="creditor" className="flex items-center gap-xs">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('pages.loans.form.creditorLabel')}
                </Label>
                <Select
                  value={formData.creditor.toString()}
                  onValueChange={(value) => set({ creditor: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(isEditing
                      ? members.filter(
                          (m) => !currentUserMemberId || m.id !== currentUserMemberId
                        )
                      : eligibleCreditors
                    ).map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="status" className="flex items-center gap-xs">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.statusLabel')}
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => set({ status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOAN_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`pages.loans.statuses.${status}`, { defaultValue: status })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>
      )}

      {/* Etapa 3: Condições & Extras */}
      {(step === 3 || isEditing) && (
        <FormSection
          title={
            isEditing
              ? t('common.form.sections.conditions')
              : t('pages.loans.wizard.step3')
          }
          icon={BadgePercent}
        >
          <div className="grid grid-cols-2 gap-md">
            <div>
              <Label htmlFor="installments" className="flex items-center gap-xs">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.installmentsLabel')}
              </Label>
              <Input
                id="installments"
                type="number"
                value={formData.installments}
                onChange={(e) => set({ installments: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="interest_rate" className="flex items-center gap-xs">
                <BadgePercent className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.interestRateLabel')}
              </Label>
              <Input
                id="interest_rate"
                type="number"
                step="0.01"
                value={formData.interest_rate ?? ''}
                onChange={(e) => set({ interest_rate: parseFloat(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="due_date" className="flex items-center gap-xs">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.dueDateLabel')}
              </Label>
              <DatePicker
                value={formData.due_date ?? undefined}
                onChange={(date) =>
                  set({ due_date: date ? formatLocalDate(date) : '' })
                }
                placeholder={t('pages.loans.form.dueDatePlaceholder')}
              />
            </div>

            <div>
              <Label htmlFor="payment_frequency" className="flex items-center gap-xs">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.paymentFrequencyLabel')}
              </Label>
              <Select
                value={formData.payment_frequency}
                onValueChange={(value) => set({ payment_frequency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_FREQUENCIES.map((freq) => (
                    <SelectItem key={freq} value={freq}>
                      {t(`pages.loans.frequencies.${freq}`, { defaultValue: freq })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="late_fee" className="flex items-center gap-xs">
                <BadgePercent className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.lateFeeLabel')}
              </Label>
              <CurrencyInput
                id="late_fee"
                value={formData.late_fee}
                onChange={(e) => set({ late_fee: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label htmlFor="guarantor" className="flex items-center gap-xs">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.guarantorLabel')}
              </Label>
              <Select
                value={formData.guarantor?.toString() ?? 'none'}
                onValueChange={(value) =>
                  set({ guarantor: value === 'none' ? null : parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('common.actions.select')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t('pages.loans.form.guarantorNone')}
                  </SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="notes" className="flex items-center gap-xs">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.notesLabel')}
              </Label>
              <Textarea
                id="notes"
                value={formData.notes ?? ''}
                onChange={(e) => set({ notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="contract_document" className="flex items-center gap-xs">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.loans.form.contractDocumentLabel')}
              </Label>
              <FileInput
                id="contract_document"
                onChange={(file) => set({ contract_document: file ?? null })}
              />
            </div>

            <div className="col-span-2 flex items-center gap-sm">
              <input
                type="checkbox"
                id="payed"
                checked={formData.payed}
                onChange={(e) => set({ payed: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="payed" className="cursor-pointer">
                {t('pages.loans.form.loanPaidLabel')}
              </Label>
            </div>

            {!isEditing && formData.loan_type === 'borrowed' && (
              <div className="col-span-2 space-y-xs rounded-md border p-sm">
                <div className="flex items-center gap-sm">
                  <input
                    type="checkbox"
                    id="generate_revenue"
                    checked={formData.generate_revenue ?? false}
                    onChange={(e) => set({ generate_revenue: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="generate_revenue" className="cursor-pointer">
                    {t('pages.loans.form.generateRevenueLabel')}
                  </Label>
                </div>
                {formData.generate_revenue && (
                  <p className="text-xs text-muted-foreground">
                    {t('pages.loans.form.generateRevenueHint')}
                  </p>
                )}
              </div>
            )}

            {!isEditing && formData.loan_type === 'lent' && (
              <div className="col-span-2 space-y-xs rounded-md border p-sm">
                <div className="flex items-center gap-sm">
                  <input
                    type="checkbox"
                    id="generate_expense"
                    checked={formData.generate_expense ?? false}
                    onChange={(e) => set({ generate_expense: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="generate_expense" className="cursor-pointer">
                    {t('pages.loans.form.generateExpenseLabel')}
                  </Label>
                </div>
                {formData.generate_expense && (
                  <p className="text-xs text-muted-foreground">
                    {t('pages.loans.form.generateExpenseHint')}
                  </p>
                )}
              </div>
            )}
          </div>
        </FormSection>
      )}

      {balanceInfo && formData.value > 0 && (
        <div
          className={`flex items-start gap-2 rounded-md border p-sm text-sm ${
            !balanceInfo.canPay
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-warning/30 bg-warning/10 text-warning'
          }`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {!balanceInfo.canPay
              ? t('common.balance.insufficientEvenWithOverdraft', {
                  available: formatCurrency(balanceInfo.available.toFixed(2)),
                })
              : t('common.balance.overdraftWarningDesc', {
                  balance: formatCurrency(balanceInfo.balance.toFixed(2)),
                  overdraft: formatCurrency(balanceInfo.overdraft.toFixed(2)),
                  total: formatCurrency(balanceInfo.available.toFixed(2)),
                })}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-sm border-t pt-md">
        {step > 1 && !isEditing && (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
            {t('common.actions.back')}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isLoading || (!!balanceInfo && !balanceInfo.canPay)}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-sm h-4 w-4 animate-spin" />
              {t('common.actions.saving')}
            </>
          ) : !isEditing && step < totalSteps ? (
            <>
              {t('pages.loans.wizard.next')}
              <ArrowRight className="ml-sm h-4 w-4" />
            </>
          ) : (
            t('common.actions.save')
          )}
        </Button>
      </div>
    </form>
  );
}
