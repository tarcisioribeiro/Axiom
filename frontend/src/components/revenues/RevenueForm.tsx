/* eslint-disable max-lines, react-hooks/incompatible-library */
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  Link2,
  Tag,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

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
import {
  REVENUE_CATEGORIES_CANONICAL,
  TRANSLATIONS,
  translate,
} from '@/config/constants';
import { REVENUE_CATEGORY_ICONS } from '@/config/icons';
import { logger } from '@/lib/logger';
import { formatLocalDate } from '@/lib/utils';
import { membersService } from '@/services/members-service';
import type { Account, Loan, Member, Revenue, RevenueFormData } from '@/types';

export interface RevenuePrefillData {
  description?: string;
  value?: number;
  date?: string;
}

interface RevenueFormProps {
  revenue?: Revenue;
  prefillData?: RevenuePrefillData;
  accounts: Account[];
  loans?: Loan[];
  onSubmit: (data: RevenueFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const RevenueForm: React.FC<RevenueFormProps> = ({
  revenue,
  prefillData,
  accounts,
  loans,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const [currentUserMember, setCurrentUserMember] = useState<Member | null>(null);
  const [eligibleLoans, setEligibleLoans] = useState<Loan[]>([]);
  const [linksOpen, setLinksOpen] = useState(false);

  const { register, handleSubmit, setValue, watch } = useForm<RevenueFormData>({
    defaultValues: revenue
      ? {
          description: revenue.description,
          value: parseFloat(revenue.value),
          date: revenue.date,
          horary: revenue.horary,
          category: revenue.category,
          account: revenue.account,
          received: revenue.received,
          source: revenue.source,
          tax_amount: revenue.tax_amount ? parseFloat(revenue.tax_amount) : 0,
          member: revenue.member,
          recurring: revenue.recurring,
          frequency: revenue.frequency || undefined,
          notes: revenue.notes,
          related_loan: revenue.related_loan || null,
        }
      : {
          date: formatLocalDate(new Date()),
          horary: new Date().toTimeString().slice(0, 5),
          received: false,
          recurring: false,
        },
  });

  useEffect(() => {
    const loadCurrentUserMember = async () => {
      try {
        const member = await membersService.getCurrentUserMember();
        setCurrentUserMember(member);
        if (!revenue) setValue('member', member.id);
      } catch (error) {
        logger.error('Erro ao carregar membro do usuário:', error);
      }
    };
    void loadCurrentUserMember();
  }, [revenue, setValue]);

  useEffect(() => {
    if (loans && currentUserMember) {
      const filtered = loans.filter(
        (loan) =>
          loan.creditor === currentUserMember.id &&
          loan.status !== 'paid' &&
          loan.status !== 'cancelled'
      );
      setEligibleLoans(filtered);
    }
  }, [loans, currentUserMember]);

  useEffect(() => {
    if (!revenue && prefillData) {
      if (prefillData.description !== undefined)
        setValue('description', prefillData.description);
      if (prefillData.value !== undefined) setValue('value', prefillData.value);
      if (prefillData.date !== undefined) setValue('date', prefillData.date);
    }
  }, [revenue, prefillData, setValue]);

  const watchedReceived = watch('received');
  const watchedValue = watch('value') ?? 0;
  const selectedAccount = accounts.find((a) => a.id === watch('account'));
  const hasEligibleLinks = eligibleLoans.length > 0;

  // Use REVENUE_CATEGORIES_CANONICAL if available, otherwise fall back to TRANSLATIONS
  const revenueCategories =
    REVENUE_CATEGORIES_CANONICAL.length > 0
      ? REVENUE_CATEGORIES_CANONICAL
      : Object.keys(TRANSLATIONS.revenueCategories).map((k) => ({
          key: k,
          label: '',
        }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-lg">
      {/* Seção: Informações Básicas */}
      <FormSection title={t('common.form.sections.basicInfo')} icon={TrendingUp}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label className="flex items-center gap-xs">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.revenues.form.descriptionLabel')}
            </Label>
            <Input
              {...register('description', { required: true })}
              placeholder={t('pages.revenues.form.descriptionPlaceholder')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm md:col-span-2">
            <Label className="flex items-center gap-xs">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.revenues.form.sourceLabel')}
              <span className="ml-1 text-xs text-muted-foreground/70">
                ({t('common.actions.none').toLowerCase()})
              </span>
            </Label>
            <Input
              {...register('source')}
              placeholder={t('pages.revenues.form.sourcePlaceholder')}
              disabled={isLoading}
            />
          </div>
        </div>
      </FormSection>

      {/* Seção: Valores & Data */}
      <FormSection title={t('common.form.sections.values')} icon={Wallet}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.revenues.form.valueLabel')}
            </Label>
            <CurrencyInput
              accentColor="success"
              value={watchedValue}
              onChange={(e) => setValue('value', parseFloat(e.target.value) || 0)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.revenues.form.receivedLabel')}
            </Label>
            <StatusToggle
              value={watchedReceived ? 'true' : 'false'}
              options={[
                {
                  value: 'false',
                  label: t('common.status.pending'),
                  activeClass: 'bg-background text-foreground shadow-sm',
                },
                {
                  value: 'true',
                  label: t('pages.revenues.statusReceived'),
                  activeClass: 'bg-success/15 text-success shadow-sm',
                },
              ]}
              onChange={(v) => setValue('received', v === 'true')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.revenues.form.dateLabel')}
            </Label>
            <DatePicker
              value={watch('date')}
              onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
              placeholder={t('common.fields.selectDate')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.revenues.form.horaryLabel')}
            </Label>
            <TimePicker
              value={watch('horary')}
              onChange={(t) => setValue('horary', t ?? '')}
              disabled={isLoading}
            />
          </div>
        </div>
      </FormSection>

      {/* Seção: Classificação */}
      <FormSection title={t('common.form.sections.classification')} icon={Tag}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.revenues.form.categoryLabel')}
            </Label>
            <Select
              value={watch('category')}
              onValueChange={(v) => setValue('category', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('common.actions.select')} />
              </SelectTrigger>
              <SelectContent>
                {revenueCategories.map(({ key }) => {
                  const Icon = REVENUE_CATEGORY_ICONS[key];
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {Icon && (
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        {translate('revenueCategories', key)}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.revenues.form.accountLabel')}
            </Label>
            <Select
              value={watch('account')?.toString()}
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
                {t('common.fields.balance_info', {
                  value: parseFloat(selectedAccount.balance).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  }),
                })}
              </p>
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
            <div className="space-y-sm">
              <Label className="flex items-center gap-xs">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.revenues.form.relatedLoanLabel')}
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
                {t('pages.revenues.form.relatedLoanHint')}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-sm border-t pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? t('common.actions.saving')
            : revenue
              ? t('common.actions.update')
              : t('common.actions.create')}
        </Button>
      </div>
    </form>
  );
};
