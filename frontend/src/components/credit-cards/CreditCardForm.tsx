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
import { formatLocalDate } from '@/lib/utils';
import type { CreditCard, CreditCardFormData, Account } from '@/types';

interface CreditCardFormProps {
  creditCard?: CreditCard;
  accounts: Account[];
  onSubmit: (data: CreditCardFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const CreditCardForm: React.FC<CreditCardFormProps> = ({
  creditCard,
  accounts,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const { register, handleSubmit, setValue, watch } = useForm<CreditCardFormData>({
    defaultValues: creditCard
      ? {
          name: creditCard.name,
          on_card_name: creditCard.on_card_name,
          card_number: '',
          flag: creditCard.flag,
          security_code: '',
          validation_date: creditCard.validation_date,
          credit_limit: parseFloat(creditCard.credit_limit),
          max_limit: parseFloat(creditCard.max_limit),
          due_day: creditCard.due_day,
          closing_day: creditCard.closing_day,
          associated_account: creditCard.associated_account,
          is_active: creditCard.is_active,
          interest_rate: creditCard.interest_rate
            ? parseFloat(creditCard.interest_rate)
            : undefined,
          annual_fee: creditCard.annual_fee
            ? parseFloat(creditCard.annual_fee)
            : undefined,
          owner: creditCard.owner,
          notes: creditCard.notes,
        }
      : {
          credit_limit: 0,
          max_limit: 0,
          due_day: 10,
          closing_day: 5,
          is_active: true,
        },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-md">
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <div className="space-y-sm">
          <Label>{t('pages.creditCards.form.nameLabel')}</Label>
          <Input
            {...register('name', { required: true })}
            placeholder={t('pages.creditCards.form.namePlaceholder')}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-sm">
          <Label>{t('pages.creditCards.form.onCardNameLabel')}</Label>
          <Input
            {...register('on_card_name', { required: true })}
            placeholder={t('pages.creditCards.form.onCardNamePlaceholder')}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-sm">
          <Label>{t('pages.creditCards.form.flagLabel')}</Label>
          <Select value={watch('flag')} onValueChange={(v) => setValue('flag', v)}>
            <SelectTrigger>
              <SelectValue placeholder={t('common.actions.select')} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TRANSLATIONS.cardBrands).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-sm">
          <Label>{t('pages.creditCards.form.cardNumberLabel')}</Label>
          <Input
            {...register('card_number', { required: true })}
            placeholder="1234567890123456"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-sm">
          <Label>{t('pages.creditCards.form.cvvLabel')}</Label>
          <Input
            {...register('security_code', { required: true })}
            placeholder="123"
            maxLength={4}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-sm">
          <Label>{t('pages.creditCards.form.validationDateLabel')}</Label>
          <DatePicker
            value={watch('validation_date')}
            onChange={(date) =>
              setValue('validation_date', date ? formatLocalDate(date) : '')
            }
            placeholder={t('pages.creditCards.form.validationDatePlaceholder')}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-sm">
          <Label>{t('pages.creditCards.form.creditLimitLabel')}</Label>
          <Input
            type="number"
            step="0.01"
            {...register('credit_limit', { required: true, valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-sm">
          <Label>{t('pages.creditCards.form.maxLimitLabel')}</Label>
          <Input
            type="number"
            step="0.01"
            {...register('max_limit', { required: true, valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-sm">
          <Label>{t('pages.creditCards.form.associatedAccountLabel')}</Label>
          <Select
            value={watch('associated_account')?.toString()}
            onValueChange={(v) => setValue('associated_account', parseInt(v))}
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
        <div className="space-y-sm">
          <Label>{t('pages.creditCards.form.dueDayLabel')}</Label>
          <Input
            type="number"
            min="1"
            max="31"
            {...register('due_day', { required: true, valueAsNumber: true })}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-sm">
          <Label>{t('pages.creditCards.form.closingDayLabel')}</Label>
          <Input
            type="number"
            min="1"
            max="31"
            {...register('closing_day', { required: true, valueAsNumber: true })}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-sm">
          <Label>{t('pages.creditCards.form.interestRateLabel')}</Label>
          <Input
            type="number"
            step="0.01"
            {...register('interest_rate', { valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-sm">
          <Label>{t('pages.creditCards.form.annualFeeLabel')}</Label>
          <Input
            type="number"
            step="0.01"
            {...register('annual_fee', { valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-sm md:col-span-2">
          <Label>{t('pages.creditCards.form.notesLabel')}</Label>
          <Input
            {...register('notes')}
            placeholder={t('pages.creditCards.form.notesPlaceholder')}
            disabled={isLoading}
          />
        </div>
      </div>
      <div className="flex justify-end gap-sm pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? t('common.actions.saving')
            : creditCard
              ? t('common.actions.update')
              : t('common.actions.create')}
        </Button>
      </div>
    </form>
  );
};
