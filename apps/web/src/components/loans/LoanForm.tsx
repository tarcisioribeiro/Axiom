/* eslint-disable max-lines */
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  BadgePercent,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Hash,
  Loader2,
  Percent,
  Save,
  Shield,
  Tag,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';
import { DecimalInput } from '@/components/ui/decimal-input';
import { FileInput } from '@/components/ui/file-input';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
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
import { cn, formatLocalDate } from '@/lib/utils';
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
          due_date: formatLocalDate(new Date()),
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
  // Na edição as 3 etapas aparecem juntas: 3 colunas para caber sem rolagem.
  const cols = isEditing ? 'grid-cols-3' : 'grid-cols-2';

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
                  <div className="gap-xs flex flex-col items-center">
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
                      className={`text-center text-xs ${isActive ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
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
          <div className={cn('gap-md grid', cols)}>
            {!isEditing && (
              <div className="col-span-2">
                <Label className="gap-xs flex items-center">
                  <Shield className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.loans.form.loanTypeLabel')}
                </Label>
                <div className="mt-sm gap-sm grid grid-cols-2">
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
                      className={`gap-sm p-md flex flex-col items-center rounded-lg border-2 transition ${
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
              <Label htmlFor="description" className="gap-xs flex items-center">
                <FileText className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.loans.form.descriptionLabel')}
              </Label>
              <Input
                id="description"
                placeholder={t('common.placeholders.loanDescription')}
                value={formData.description}
                onChange={(e) => set({ description: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="value" className="gap-xs flex items-center">
                <Wallet className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.loans.form.totalValueLabel')}
              </Label>
              <CurrencyInput
                id="value"
                value={formData.value}
                onChange={(e) => set({ value: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label htmlFor="payed_value" className="gap-xs flex items-center">
                <Wallet className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.loans.form.paidValueLabel')}
                {loan ? ` ${t('pages.loans.form.paidValueCalculated')}` : ' *'}
              </Label>
              <CurrencyInput
                id="payed_value"
                value={formData.payed_value}
                onChange={(e) => set({ payed_value: parseFloat(e.target.value) || 0 })}
                disabled={!!loan}
                className={loan ? 'bg-muted cursor-not-allowed' : ''}
              />
            </div>

            <div>
              <Label htmlFor="date" className="gap-xs flex items-center">
                <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.loans.form.dateLabel')}
              </Label>
              <DatePicker
                value={formData.date ?? undefined}
                onChange={(date) => set({ date: date ? formatLocalDate(date) : '' })}
                placeholder={t('pages.loans.form.datePlaceholder')}
              />
            </div>

            <div>
              <Label htmlFor="horary" className="gap-xs flex items-center">
                <Clock className="text-muted-foreground h-3.5 w-3.5" />
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
          <div className={cn('gap-md grid', cols)}>
            <div>
              <Label htmlFor="category" className="gap-xs flex items-center">
                <Tag className="text-muted-foreground h-3.5 w-3.5" />
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
                            <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
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
              <Label htmlFor="account" className="gap-xs flex items-center">
                <Wallet className="text-muted-foreground h-3.5 w-3.5" />
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
                      <span className="text-muted-foreground ml-2 text-xs">
                        {formatCurrency(acc.balance)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {((!isEditing && formData.loan_type === 'lent') || isEditing) && (
              <div>
                <Label htmlFor="benefited" className="gap-xs flex items-center">
                  <Users className="text-muted-foreground h-3.5 w-3.5" />
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
                          (m) =>
                            !currentUserMemberId ||
                            m.id !== currentUserMemberId ||
                            m.id === formData.benefited
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
                <Label htmlFor="creditor" className="gap-xs flex items-center">
                  <Users className="text-muted-foreground h-3.5 w-3.5" />
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
                          (m) =>
                            !currentUserMemberId ||
                            m.id !== currentUserMemberId ||
                            m.id === formData.creditor
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
              <Label htmlFor="status" className="gap-xs flex items-center">
                <CheckCircle2 className="text-muted-foreground h-3.5 w-3.5" />
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
          <div className={cn('gap-md grid', cols)}>
            <div>
              <Label htmlFor="installments" className="gap-xs flex items-center">
                <Hash className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.loans.form.installmentsLabel')}
              </Label>
              <NumberStepper
                id="installments"
                min={1}
                value={formData.installments}
                onChange={(v) => set({ installments: v ?? 1 })}
              />
            </div>

            <div>
              <Label htmlFor="interest_rate" className="gap-xs flex items-center">
                <Percent className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.loans.form.interestRateLabel')}
              </Label>
              <DecimalInput
                id="interest_rate"
                unit="%"
                value={formData.interest_rate}
                onChange={(v) => set({ interest_rate: v ?? undefined })}
              />
            </div>

            <div>
              <Label htmlFor="due_date" className="gap-xs flex items-center">
                <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
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
              <Label htmlFor="payment_frequency" className="gap-xs flex items-center">
                <Clock className="text-muted-foreground h-3.5 w-3.5" />
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
              <Label htmlFor="late_fee" className="gap-xs flex items-center">
                <Wallet className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.loans.form.lateFeeLabel')}
              </Label>
              <CurrencyInput
                id="late_fee"
                value={formData.late_fee}
                onChange={(e) => set({ late_fee: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label htmlFor="guarantor" className="gap-xs flex items-center">
                <Shield className="text-muted-foreground h-3.5 w-3.5" />
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

            <div className={isEditing ? 'col-span-3' : 'col-span-2'}>
              <Label htmlFor="notes" className="gap-xs flex items-center">
                <FileText className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.loans.form.notesLabel')}
              </Label>
              <Textarea
                id="notes"
                placeholder={t('common.placeholders.notes')}
                value={formData.notes ?? ''}
                onChange={(e) => set({ notes: e.target.value })}
                rows={1}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="contract_document" className="gap-xs flex items-center">
                <FileText className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.loans.form.contractDocumentLabel')}
              </Label>
              <FileInput
                id="contract_document"
                onChange={(file) => set({ contract_document: file ?? null })}
              />
            </div>

            <div
              className={cn(
                'gap-sm flex items-center',
                isEditing ? 'pb-sm col-span-1 self-end' : 'col-span-2'
              )}
            >
              <Checkbox
                id="payed"
                checked={formData.payed}
                onCheckedChange={(v) => set({ payed: v === true })}
              />
              <Label
                htmlFor="payed"
                className="gap-xs flex cursor-pointer items-center"
              >
                <CheckCircle2 className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.loans.form.loanPaidLabel')}
              </Label>
            </div>

            {!isEditing && formData.loan_type === 'borrowed' && (
              <div className="space-y-xs p-sm col-span-2 rounded-md border">
                <div className="gap-sm flex items-center">
                  <Checkbox
                    id="generate_revenue"
                    checked={formData.generate_revenue ?? false}
                    onCheckedChange={(v) => set({ generate_revenue: v === true })}
                  />
                  <Label
                    htmlFor="generate_revenue"
                    className="gap-xs flex cursor-pointer items-center"
                  >
                    <TrendingUp className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.loans.form.generateRevenueLabel')}
                  </Label>
                </div>
              </div>
            )}

            {!isEditing && formData.loan_type === 'lent' && (
              <div className="space-y-xs p-sm col-span-2 rounded-md border">
                <div className="gap-sm flex items-center">
                  <Checkbox
                    id="generate_expense"
                    checked={formData.generate_expense ?? false}
                    onCheckedChange={(v) => set({ generate_expense: v === true })}
                  />
                  <Label
                    htmlFor="generate_expense"
                    className="gap-xs flex cursor-pointer items-center"
                  >
                    <TrendingDown className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.loans.form.generateExpenseLabel')}
                  </Label>
                </div>
              </div>
            )}
          </div>
        </FormSection>
      )}

      {balanceInfo && formData.value > 0 && (
        <div
          className={`p-sm flex items-start gap-2 rounded-md border text-sm ${
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

      <div className="dialog-footer gap-sm pt-md flex justify-end border-t">
        {step > 1 && !isEditing && (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="h-4 w-4" />
            {t('common.actions.back')}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isLoading || (!!balanceInfo && !balanceInfo.canPay)}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.actions.saving')}
            </>
          ) : !isEditing && step < totalSteps ? (
            <>
              <ArrowRight className="h-4 w-4" />
              {t('pages.loans.wizard.next')}
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {t('common.actions.save')}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
