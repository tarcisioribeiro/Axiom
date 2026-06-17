/* eslint-disable max-lines */
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  GitFork,
  Link2,
  Loader2,
  Sparkles,
  Store,
  Tag,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  ExpenseOCRUpload,
  type OCRResult,
} from '@/components/expenses/ExpenseOCRUpload';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';
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
import { StatusToggle } from '@/components/ui/status-toggle';
import { TimePicker } from '@/components/ui/time-picker';
import { EXPENSE_CATEGORIES_CANONICAL, translate } from '@/config/constants';
import { EXPENSE_CATEGORY_ICONS } from '@/config/icons';
import { formatCurrency } from '@/lib/formatters';
import { getAccountBalanceInfo } from '@/lib/helpers';
import { logger } from '@/lib/logger';
import { formatLocalDate } from '@/lib/utils';
import { expenseSchema } from '@/lib/validations';
import { accountsService } from '@/services/accounts-service';
import { categorizationRulesService } from '@/services/categorization-rules-service';
import type { CategorySuggestion } from '@/services/expenses-service';
import { expensesService } from '@/services/expenses-service';
import { membersService } from '@/services/members-service';
import type {
  Account,
  CategorizationRule,
  Expense,
  ExpenseFormData,
  Loan,
  Member,
  Payable,
} from '@/types';

export interface ExpensePrefillData {
  description?: string;
  value?: number;
  date?: string;
}

interface ExpenseFormProps {
  expense?: Expense;
  prefillData?: ExpensePrefillData;
  accounts: Account[];
  loans?: Loan[];
  payables?: Payable[];
  onSubmit: (data: ExpenseFormData, splitOnCreate?: boolean) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  expense,
  prefillData,
  accounts,
  loans,
  payables,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const [currentUserMember, setCurrentUserMember] = useState<Member | null>(null);
  const [eligibleLoans, setEligibleLoans] = useState<Loan[]>([]);
  const [eligiblePayables, setEligiblePayables] = useState<Payable[]>([]);
  const [categorizationRules, setCategorizationRules] = useState<CategorizationRule[]>(
    []
  );
  const [linksOpen, setLinksOpen] = useState(false);
  const [splitOnCreate, setSplitOnCreate] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<CategorySuggestion | null>(null);
  const [isLoadingAiSuggestion, setIsLoadingAiSuggestion] = useState(false);
  const merchantDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiSuggestionAbortRef = useRef<AbortController | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema) as Resolver<ExpenseFormData>,
    defaultValues: {
      description: '',
      value: 0,
      date: formatLocalDate(new Date()),
      horary: new Date().toTimeString().split(' ')[0].substring(0, 5),
      payed: false,
      category: '',
      account: 0,
      member: null,
      merchant: '',
      related_loan: null,
      related_payable: null,
    },
  });

  useEffect(() => {
    const loadCurrentUserMember = async () => {
      try {
        const member = await membersService.getCurrentUserMember();
        setCurrentUserMember(member);
        if (!expense) setValue('member', member.id);
      } catch (error) {
        logger.error('Erro ao carregar membro do usuário:', error);
      }
    };
    const loadRules = async () => {
      try {
        const data = await categorizationRulesService.getAll();
        const rules = Array.isArray(data)
          ? data
          : ((data as { results: CategorizationRule[] }).results ?? []);
        setCategorizationRules(rules.filter((r) => r.is_active));
      } catch {
        // rules are optional
      }
    };
    void loadCurrentUserMember();
    void loadRules();
  }, [expense, setValue]);

  useEffect(() => {
    if (loans && currentUserMember) {
      const filtered = loans.filter(
        (loan) =>
          loan.benefited === currentUserMember.id &&
          loan.status !== 'paid' &&
          loan.status !== 'cancelled'
      );
      setEligibleLoans(filtered);
    }
  }, [loans, currentUserMember]);

  useEffect(() => {
    if (payables) {
      const filtered = payables.filter(
        (p) => p.status === 'active' || p.status === 'overdue'
      );
      setEligiblePayables(filtered);
    }
  }, [payables]);

  useEffect(() => {
    if (expense) {
      setValue('description', expense.description);
      setValue('value', parseFloat(expense.value));
      setValue('date', expense.date);
      setValue('horary', expense.horary);
      setValue('category', expense.category);
      setValue('payed', expense.payed);
      setValue('account', expense.account);
      setValue('member', expense.member);
      setValue('merchant', expense.merchant ?? '');
      setValue('related_loan', expense.related_loan || null);
      setValue('related_payable', expense.related_payable || null);
    } else if (accounts.length > 0) {
      setValue('account', accounts[0].id, { shouldDirty: true });
    }
  }, [expense, accounts, setValue]);

  const fetchAiSuggestion = async (merchant: string) => {
    const description = watch('description');
    if (!merchant.trim() && !description?.trim()) return;

    if (aiSuggestionAbortRef.current) aiSuggestionAbortRef.current.abort();
    aiSuggestionAbortRef.current = new AbortController();

    setIsLoadingAiSuggestion(true);
    setAiSuggestion(null);
    try {
      const result = await Promise.race([
        expensesService.suggestCategory({
          description: description || '',
          merchant,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 10000)
        ),
      ]);
      const currentCat = watch('category');
      const categoryIsEmpty =
        !currentCat || currentCat === 'others' || currentCat === '';
      if (result.method === 'rule' && categoryIsEmpty) {
        setValue('category', result.category);
      } else if (result.method === 'llm' && result.category !== 'others') {
        setAiSuggestion(result);
      }
    } catch {
      // silent — LLM é opcional
    } finally {
      setIsLoadingAiSuggestion(false);
    }
  };

  const handleMerchantChange = (value: string) => {
    setValue('merchant', value);
    setAiSuggestion(null);
    if (merchantDebounceRef.current) clearTimeout(merchantDebounceRef.current);
    if (!value.trim()) {
      setIsLoadingAiSuggestion(false);
      return;
    }
    merchantDebounceRef.current = setTimeout(() => {
      const lower = value.toLowerCase();

      // Verificação heurística local (feedback imediato, sem chamada de rede)
      if (categorizationRules.length > 0) {
        const matched = categorizationRules.find(
          (rule) =>
            lower.includes(rule.merchant_contains.toLowerCase()) ||
            rule.merchant_contains.toLowerCase().includes(lower)
        );
        if (matched) {
          const currentCategory = watch('category');
          if (
            !currentCategory ||
            currentCategory === 'others' ||
            currentCategory === ''
          ) {
            setValue('category', matched.category);
          }
          return; // Regra local encontrada — sem necessidade de chamar API
        }
      }

      // Nenhuma regra local correspondeu: tenta LLM via API
      void fetchAiSuggestion(value);
    }, 600);
  };

  useEffect(() => {
    if (!expense && prefillData) {
      if (prefillData.description !== undefined)
        setValue('description', prefillData.description);
      if (prefillData.value !== undefined) setValue('value', prefillData.value);
      if (prefillData.date !== undefined) setValue('date', prefillData.date);
    }
  }, [expense, prefillData, setValue]);

  const watchedPayed = watch('payed');
  const watchedAccount = watch('account');
  const watchedValue = watch('value');
  const watchedDate = watch('date');
  const today = formatLocalDate(new Date());
  const isFutureDate = watchedDate > today;

  const [projectedBalance, setProjectedBalance] = useState<string | null>(null);
  const [isLoadingProjected, setIsLoadingProjected] = useState(false);

  useEffect(() => {
    if (!watchedAccount || !watchedDate || !(watchedValue > 0) || !isFutureDate) {
      setProjectedBalance(null);
      return;
    }
    setIsLoadingProjected(true);
    accountsService
      .getProjectedBalance(watchedAccount, watchedDate)
      .then((data) => setProjectedBalance(data.projected_balance))
      .catch(() => setProjectedBalance(null))
      .finally(() => setIsLoadingProjected(false));
  }, [watchedAccount, watchedDate, watchedValue, isFutureDate]);

  const balanceInfo = useMemo(() => {
    if (isFutureDate) return null;
    if (!watchedPayed || !watchedAccount || watchedValue <= 0) return null;
    const acc = accounts.find((a) => a.id === watchedAccount);
    if (!acc) return null;
    return getAccountBalanceInfo(acc, watchedValue);
  }, [watchedPayed, watchedAccount, watchedValue, accounts, isFutureDate]);

  const futureBalanceInfo = useMemo(() => {
    if (!isFutureDate || watchedValue <= 0 || !watchedAccount) return null;
    const acc = accounts.find((a) => a.id === watchedAccount);
    if (!acc) return null;
    const overdraft = parseFloat(acc.overdraft_limit ?? '0');
    if (watchedPayed) return getAccountBalanceInfo(acc, watchedValue);
    if (projectedBalance === null) return null;
    const proj = parseFloat(projectedBalance);
    const available = proj + overdraft;
    return {
      balance: proj,
      overdraft,
      available,
      canPay: available >= watchedValue,
      isUsingOverdraft: proj < watchedValue && available >= watchedValue,
    };
  }, [
    isFutureDate,
    watchedValue,
    watchedAccount,
    watchedPayed,
    projectedBalance,
    accounts,
  ]);

  const handleFormSubmit = (data: ExpenseFormData) => {
    if (data.payed && balanceInfo && !balanceInfo.canPay) return;
    if (futureBalanceInfo && !futureBalanceInfo.canPay) return;
    onSubmit(data, !expense && splitOnCreate);
  };

  const selectedAccount = accounts.find((a) => a.id === watchedAccount);
  const hasEligibleLinks = eligibleLoans.length > 0 || eligiblePayables.length > 0;

  const handleOCRResult = (result: OCRResult) => {
    if (result.merchant) setValue('description', result.merchant);
    if (result.value) {
      const num = parseFloat(result.value.replace(',', '.'));
      if (!isNaN(num)) setValue('value', num);
    }
    if (result.date) setValue('date', result.date);
    if (result.merchant) handleMerchantChange(result.merchant);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg" noValidate>
      {!expense && (
        <div className="flex items-center justify-end">
          <ExpenseOCRUpload onResult={handleOCRResult} />
        </div>
      )}
      {/* Seção: Informações Básicas */}
      <FormSection title={t('common.form.sections.basicInfo')} icon={Store}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="description" className="flex items-center gap-xs">
              <Store className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.expenses.form.descriptionLabel')}
            </Label>
            <Input
              id="description"
              {...register('description')}
              placeholder={t('pages.expenses.form.descriptionPlaceholder')}
              disabled={isLoading}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="merchant" className="flex items-center gap-xs">
              <Store className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.expenses.form.merchantLabel')}
              <span className="ml-1 text-xs text-muted-foreground/70">
                ({t('common.actions.none').toLowerCase()})
              </span>
            </Label>
            <Input
              id="merchant"
              value={watch('merchant') ?? ''}
              onChange={(e) => handleMerchantChange(e.target.value)}
              placeholder={t('pages.expenses.form.merchantPlaceholder')}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              {t('pages.expenses.form.merchantHint')}
            </p>
          </div>
        </div>
      </FormSection>

      {/* Seção: Valores & Data */}
      <FormSection title={t('common.form.sections.values')} icon={Wallet}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm">
            <Label htmlFor="value" className="flex items-center gap-xs">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.expenses.form.valueLabel')}
            </Label>
            <CurrencyInput
              id="value"
              accentColor="destructive"
              value={watchedValue}
              onChange={(e) => setValue('value', parseFloat(e.target.value) || 0)}
              disabled={isLoading}
            />
            {errors.value && (
              <p className="text-sm text-destructive">{errors.value.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.expenses.form.paymentStatusLabel')}
            </Label>
            <StatusToggle
              value={watchedPayed ? 'true' : 'false'}
              options={[
                {
                  value: 'false',
                  label: t('pages.expenses.form.pending'),
                  activeClass: 'bg-background text-foreground shadow-sm',
                },
                {
                  value: 'true',
                  label: t('pages.expenses.form.paid'),
                  activeClass: 'bg-success/15 text-success shadow-sm',
                },
              ]}
              onChange={(v) => setValue('payed', v === 'true')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label htmlFor="date" className="flex items-center gap-xs">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.expenses.form.dateLabel')}
            </Label>
            <DatePicker
              value={watch('date')}
              onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
              placeholder={t('common.fields.selectDate')}
              disabled={isLoading}
            />
            {errors.date && (
              <p className="text-sm text-destructive">{errors.date.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="horary" className="flex items-center gap-xs">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.expenses.form.horaryLabel')}
            </Label>
            <TimePicker
              value={watch('horary')}
              onChange={(t) => setValue('horary', t ?? '')}
              disabled={isLoading}
            />
            {errors.horary && (
              <p className="text-sm text-destructive">{errors.horary.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      {/* Seção: Classificação */}
      <FormSection title={t('common.form.sections.classification')} icon={Tag}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.expenses.form.categoryLabel')}
            </Label>
            <div className="relative">
              <Select
                value={watch('category') || ''}
                onValueChange={(v) => {
                  setValue('category', v);
                  setAiSuggestion(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('common.actions.select')} />
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
            {isLoadingAiSuggestion && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{t('pages.expenses.form.aiSuggesting')}</span>
              </div>
            )}
            {aiSuggestion && !isLoadingAiSuggestion && (
              <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="text-muted-foreground">
                  {t('pages.expenses.form.aiSuggested')}:{' '}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => {
                      setValue('category', aiSuggestion.category);
                      setAiSuggestion(null);
                    }}
                  >
                    {translate('expenseCategories', aiSuggestion.category)}
                  </button>
                </span>
                <button
                  type="button"
                  aria-label={t('common.actions.close')}
                  className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setAiSuggestion(null)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.expenses.form.accountLabel')}
            </Label>
            <Select
              value={watch('account')?.toString() || ''}
              onValueChange={(v) => setValue('account', parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('common.actions.select')} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    <span>{a.account_name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {parseFloat(a.balance).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccount && (
              <p className="text-xs text-muted-foreground">
                {t('pages.expenses.form.balanceInfo', {
                  value: parseFloat(selectedAccount.balance).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  }),
                })}
              </p>
            )}
            {errors.account && (
              <p className="text-sm text-destructive">{errors.account.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      {/* Seção: Vínculos (colapsável) */}
      {hasEligibleLinks && (
        <div className="space-y-md">
          <button
            type="button"
            onClick={() => setLinksOpen((o) => !o)}
            className="flex w-full items-center gap-xs text-left"
          >
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('common.form.sections.links')}
            </span>
            <div className="h-px flex-1 bg-border/50" />
            {linksOpen ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>

          {linksOpen && (
            <div className="grid grid-cols-1 gap-md md:grid-cols-2">
              {eligibleLoans.length > 0 && (
                <div className="space-y-sm">
                  <Label className="flex items-center gap-xs">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('pages.expenses.form.relatedLoanLabel')}
                  </Label>
                  <Select
                    value={watch('related_loan')?.toString() || 'none'}
                    onValueChange={(v) =>
                      setValue('related_loan', v === 'none' ? null : parseInt(v))
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.fields.select_optional')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('common.actions.none')}</SelectItem>
                      {eligibleLoans.map((loan) => (
                        <SelectItem key={loan.id} value={loan.id.toString()}>
                          {loan.description} — R$ {loan.remaining_balance || '0.00'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('pages.expenses.form.relatedLoanHint')}
                  </p>
                </div>
              )}

              {eligiblePayables.length > 0 && (
                <div className="space-y-sm">
                  <Label className="flex items-center gap-xs">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('pages.expenses.form.relatedPayableLabel')}
                  </Label>
                  <Select
                    value={watch('related_payable')?.toString() || 'none'}
                    onValueChange={(v) =>
                      setValue('related_payable', v === 'none' ? null : parseInt(v))
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.fields.select_optional')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('common.actions.none')}</SelectItem>
                      {eligiblePayables.map((payable) => (
                        <SelectItem key={payable.id} value={payable.id.toString()}>
                          {payable.description} — R$ {payable.remaining_value || '0.00'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('pages.expenses.form.relatedPayableHint')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alertas de saldo */}
      {isFutureDate && watchedAccount && watchedValue > 0 && (
        <div
          className={`flex items-start gap-2 rounded-md border p-sm text-sm ${
            futureBalanceInfo && !futureBalanceInfo.canPay
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : futureBalanceInfo?.isUsingOverdraft
                ? 'border-warning/30 bg-warning/10 text-warning'
                : 'border-info/30 bg-info/10 text-info'
          }`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {isLoadingProjected
              ? t('common.balance.loadingProjected')
              : futureBalanceInfo && !futureBalanceInfo.canPay
                ? t('common.balance.insufficientEvenWithOverdraft', {
                    available: formatCurrency(futureBalanceInfo.available.toFixed(2)),
                  })
                : futureBalanceInfo?.isUsingOverdraft
                  ? t('common.balance.overdraftWarningDesc', {
                      balance: formatCurrency(futureBalanceInfo.balance.toFixed(2)),
                      overdraft: formatCurrency(futureBalanceInfo.overdraft.toFixed(2)),
                      total: formatCurrency(futureBalanceInfo.available.toFixed(2)),
                    })
                  : projectedBalance !== null
                    ? t('common.balance.projectedOn', {
                        date: watchedDate,
                        balance: formatCurrency(projectedBalance),
                      })
                    : t('common.balance.projectedUnavailable')}
          </p>
        </div>
      )}
      {balanceInfo && watchedValue > 0 && (
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

      {/* Toggle: Dividir despesa — only for new expenses */}
      {!expense && (
        <div className="flex items-center gap-sm rounded-md border border-dashed border-border px-md py-sm">
          <GitFork className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium">
              {t('pages.expenses.form.splitToggle')}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('pages.expenses.form.splitToggleHint')}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={splitOnCreate}
            onClick={() => setSplitOnCreate((v) => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              splitOnCreate ? 'bg-primary' : 'bg-input'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                splitOnCreate ? 'translate-x-[18px]' : 'translate-x-[3px]'
              }`}
            />
          </button>
        </div>
      )}

      <div className="flex justify-end gap-sm border-t pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={
            isLoading ||
            (watchedPayed && !!balanceInfo && !balanceInfo.canPay) ||
            (!!futureBalanceInfo && !futureBalanceInfo.canPay)
          }
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-xs h-4 w-4 animate-spin" />
              {t('common.actions.saving')}
            </>
          ) : expense ? (
            t('common.actions.update')
          ) : (
            t('common.actions.create')
          )}
        </Button>
      </div>
    </form>
  );
};
