import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { TRANSLATIONS } from '@/config/constants';
import { logger } from '@/lib/logger';
import { formatLocalDate } from '@/lib/utils';
import { membersService } from '@/services/members-service';
import type { Revenue, RevenueFormData, Account, Member, Loan } from '@/types';

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
        // Se não estamos editando, define o membro automaticamente
        if (!revenue) {
          setValue('member', member.id);
        }
      } catch (error) {
        logger.error('Erro ao carregar membro do usuário:', error);
      }
    };

    void loadCurrentUserMember();
  }, [revenue, setValue]);

  useEffect(() => {
    if (loans && currentUserMember) {
      // Filtrar empréstimos onde o usuário atual é o creditor (emprestou dinheiro, está recebendo de volta)
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>{t('pages.revenues.form.descriptionLabel')}</Label>
          <Input
            {...register('description', { required: true })}
            placeholder={t('pages.revenues.form.descriptionPlaceholder')}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('pages.revenues.form.valueLabel')}</Label>
          <Input
            type="number"
            step="0.01"
            {...register('value', { required: true, valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('pages.revenues.form.dateLabel')}</Label>
          <DatePicker
            value={watch('date')}
            onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
            placeholder={t('common.fields.selectDate')}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('pages.revenues.form.horaryLabel')}</Label>
          <Input
            type="time"
            {...register('horary', { required: true })}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('pages.revenues.form.categoryLabel')}</Label>
          <Select
            value={watch('category')}
            onValueChange={(v) => setValue('category', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('common.actions.select')} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TRANSLATIONS.revenueCategories).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('pages.revenues.form.accountLabel')}</Label>
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
                  {a.account_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('pages.revenues.form.sourceLabel')}</Label>
          <Input
            {...register('source')}
            placeholder={t('pages.revenues.form.sourcePlaceholder')}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('pages.revenues.form.relatedLoanLabel')}</Label>
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
          <p className="text-xs">{t('pages.revenues.form.relatedLoanHint')}</p>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register('received')}
              className="rounded"
              disabled={isLoading}
            />
            {t('pages.revenues.form.receivedLabel')}
          </Label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
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
