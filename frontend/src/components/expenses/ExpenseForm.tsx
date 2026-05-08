import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EXPENSE_CATEGORIES_CANONICAL, translate } from '@/config/constants';
import { logger } from '@/lib/logger';
import { formatLocalDate } from '@/lib/utils';
import { expenseSchema } from '@/lib/validations';
import { categorizationRulesService } from '@/services/categorization-rules-service';
import { membersService } from '@/services/members-service';
import type {
  Expense,
  ExpenseFormData,
  Account,
  Member,
  Loan,
  Payable,
  CategorizationRule,
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
  onSubmit: (data: ExpenseFormData) => void;
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
  const merchantDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        if (!expense) {
          setValue('member', member.id);
        }
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
        // rules are optional — fail silently
      }
    };

    void loadCurrentUserMember();
    void loadRules();
  }, [expense, setValue]);

  useEffect(() => {
    if (loans && currentUserMember) {
      // Filtrar empréstimos onde o usuário atual é o benefited (pegou emprestado, está pagando)
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
      // Filtrar payables ativos ou em atraso (que ainda podem receber pagamentos)
      const filtered = payables.filter(
        (payable) => payable.status === 'active' || payable.status === 'overdue'
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

  const handleMerchantChange = (value: string) => {
    setValue('merchant', value);
    if (merchantDebounceRef.current) clearTimeout(merchantDebounceRef.current);
    if (!value.trim() || categorizationRules.length === 0) return;
    merchantDebounceRef.current = setTimeout(() => {
      const lower = value.toLowerCase();
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
      }
    }, 400);
  };

  useEffect(() => {
    if (!expense && prefillData) {
      if (prefillData.description !== undefined)
        setValue('description', prefillData.description);
      if (prefillData.value !== undefined) setValue('value', prefillData.value);
      if (prefillData.date !== undefined) setValue('date', prefillData.date);
    }
  }, [expense, prefillData, setValue]);

  const handleFormSubmit = (data: ExpenseFormData) => {
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">
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
        <div className="space-y-2">
          <Label htmlFor="value">{t('pages.expenses.form.valueLabel')}</Label>
          <Input
            id="value"
            type="number"
            step="0.01"
            {...register('value', { valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
          {errors.value && (
            <p className="text-sm text-destructive">{errors.value.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">{t('pages.expenses.form.dateLabel')}</Label>
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
        <div className="space-y-2">
          <Label htmlFor="horary">{t('pages.expenses.form.horaryLabel')}</Label>
          <Input id="horary" type="time" {...register('horary')} disabled={isLoading} />
          {errors.horary && (
            <p className="text-sm text-destructive">{errors.horary.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="merchant">{t('pages.expenses.form.merchantLabel')}</Label>
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
        <div className="space-y-2">
          <Label>{t('pages.expenses.form.categoryLabel')}</Label>
          <Select
            value={watch('category') || ''}
            onValueChange={(v) => setValue('category', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('common.actions.select')} />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES_CANONICAL.map(({ key }) => (
                <SelectItem key={key} value={key}>
                  {translate('expenseCategories', key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-sm text-destructive">{errors.category.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t('pages.expenses.form.paymentStatusLabel')}</Label>
          <Select
            value={watch('payed') ? 'true' : 'false'}
            onValueChange={(v) => setValue('payed', v === 'true')}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('common.actions.select')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">
                {t('pages.expenses.form.statusPending')}
              </SelectItem>
              <SelectItem value="true">
                {t('pages.expenses.form.statusPaid')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('pages.expenses.form.accountLabel')}</Label>
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
                  {a.account_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.account && (
            <p className="text-sm text-destructive">{errors.account.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t('pages.expenses.form.relatedLoanLabel')}</Label>
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
                  {loan.description} - Saldo: R$ {loan.remaining_balance || '0.00'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs">{t('pages.expenses.form.relatedLoanHint')}</p>
        </div>
        <div className="space-y-2">
          <Label>{t('pages.expenses.form.relatedPayableLabel')}</Label>
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
                  {payable.description} - Saldo: R$ {payable.remaining_value || '0.00'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs">{t('pages.expenses.form.relatedPayableHint')}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? t('common.actions.saving')
            : expense
              ? t('common.actions.update')
              : t('common.actions.create')}
        </Button>
      </div>
    </form>
  );
};
