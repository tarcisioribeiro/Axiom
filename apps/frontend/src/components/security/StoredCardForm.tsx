/* eslint-disable max-lines, react-hooks/incompatible-library */
import {
  CalendarDaysIcon as CalendarDays,
  CreditCardIcon,
  DocumentTextIcon as FileText,
  LinkIcon as Link2,
  ArrowPathIcon as Loader2,
  ShieldCheckIcon as Shield,
  TagIcon as Tag,
} from '@heroicons/react/24/solid';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
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
import { CARD_FLAG_ICON } from '@/config/icons';
import { storedCardSchema, type StoredCreditCardFormData } from '@/lib/validations';
import { CARD_FLAGS } from '@/types';
import type { StoredCreditCard, CreditCard, Member } from '@/types';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1).padStart(2, '0'),
}));

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 20 }, (_, i) => ({
  value: currentYear + i,
  label: String(currentYear + i),
}));

interface StoredCardFormProps {
  card?: StoredCreditCard;
  creditCards?: CreditCard[];
  currentMember: Member | null;
  onSubmit: (data: StoredCreditCardFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function StoredCardForm({
  card,
  creditCards = [],
  currentMember,
  onSubmit,
  onCancel,
  isLoading = false,
}: StoredCardFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StoredCreditCardFormData>({
    resolver: zodResolver(storedCardSchema),
    defaultValues: card
      ? {
          name: card.name,
          card_number: '',
          security_code: '',
          cardholder_name: card.cardholder_name,
          expiration_month: card.expiration_month,
          expiration_year: card.expiration_year,
          flag: card.flag as StoredCreditCardFormData['flag'],
          notes: card.notes || '',
          owner: card.owner,
          finance_card: card.finance_card || undefined,
        }
      : {
          name: '',
          card_number: '',
          security_code: '',
          cardholder_name: '',
          expiration_month: 1,
          expiration_year: currentYear,
          flag: 'VSA',
          notes: '',
          owner: currentMember?.id || 0,
          finance_card: undefined,
        },
  });

  const formatCardNumber = (value: string) => value.replace(/\D/g, '').slice(0, 16);
  const formatCVV = (value: string) => value.replace(/\D/g, '').slice(0, 4);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-lg">
      <FormSection
        title={t('pages.storedCards.form.sectionIdentification')}
        icon={CreditCardIcon}
      >
        <div className="gap-md grid grid-cols-1 md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="name" className="gap-xs flex items-center">
              <CreditCardIcon className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.storedCards.form.nameLabel')}
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder={t('pages.storedCards.form.namePlaceholder')}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="mt-xs text-destructive text-sm">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="cardholder_name" className="gap-xs flex items-center">
              <CreditCardIcon className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.storedCards.form.holderLabel')}
            </Label>
            <Input
              id="cardholder_name"
              {...register('cardholder_name')}
              placeholder={t('pages.storedCards.form.holderPlaceholder')}
              disabled={isLoading}
            />
            {errors.cardholder_name && (
              <p className="mt-xs text-destructive text-sm">
                {errors.cardholder_name.message}
              </p>
            )}
          </div>

          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="flag" className="gap-xs flex items-center">
              <Tag className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.storedCards.form.brandLabel')}
            </Label>
            <Select
              value={watch('flag')}
              onValueChange={(value) =>
                setValue('flag', value as StoredCreditCardFormData['flag'])
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARD_FLAGS.map((flag) => (
                  <SelectItem key={flag.value} value={flag.value}>
                    <span className="flex items-center gap-2">
                      <CARD_FLAG_ICON className="h-4 w-4" />
                      {flag.value === 'OTHER'
                        ? t('pages.storedCards.otherBrand')
                        : flag.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.flag && (
              <p className="mt-xs text-destructive text-sm">{errors.flag.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title={t('pages.storedCards.form.sectionSensitive')} icon={Shield}>
        <div className="gap-md grid grid-cols-1 md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="card_number" className="gap-xs flex items-center">
              <Shield className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.storedCards.form.numberLabel')}
            </Label>
            <Input
              id="card_number"
              {...register('card_number')}
              placeholder={t('pages.storedCards.form.numberPlaceholder')}
              maxLength={16}
              onChange={(e) => {
                const formatted = formatCardNumber(e.target.value);
                setValue('card_number', formatted);
              }}
              disabled={isLoading}
            />
            {errors.card_number && (
              <p className="mt-xs text-destructive text-sm">
                {errors.card_number.message}
              </p>
            )}
            {!card && (
              <p className="mt-xs text-muted-foreground text-xs">
                {t('pages.storedCards.form.numberHint')}
              </p>
            )}
            {card && (
              <p className="mt-xs text-warning text-xs">
                {t('pages.storedCards.form.keepCurrentNumber')}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="security_code" className="gap-xs flex items-center">
              <Shield className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.storedCards.form.cvvLabel')}
            </Label>
            <Input
              id="security_code"
              {...register('security_code')}
              placeholder={t('pages.storedCards.form.cvvPlaceholder')}
              maxLength={4}
              onChange={(e) => {
                const formatted = formatCVV(e.target.value);
                setValue('security_code', formatted);
              }}
              disabled={isLoading}
            />
            {errors.security_code && (
              <p className="mt-xs text-destructive text-sm">
                {errors.security_code.message}
              </p>
            )}
            {card && (
              <p className="mt-xs text-warning text-xs">
                {t('pages.storedCards.form.keepCurrentCvv')}
              </p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection
        title={t('pages.storedCards.form.sectionExpiry')}
        icon={CalendarDays}
      >
        <div className="gap-md grid grid-cols-1 md:grid-cols-2">
          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.storedCards.form.expiryMonthLabel')}
            </Label>
            <Select
              value={watch('expiration_month')?.toString()}
              onValueChange={(value) => setValue('expiration_month', parseInt(value))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.expiration_month && (
              <p className="mt-xs text-destructive text-sm">
                {errors.expiration_month.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.storedCards.form.expiryYearLabel')}
            </Label>
            <Select
              value={watch('expiration_year')?.toString()}
              onValueChange={(value) => setValue('expiration_year', parseInt(value))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((year) => (
                  <SelectItem key={year.value} value={year.value.toString()}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.expiration_year && (
              <p className="mt-xs text-destructive text-sm">
                {errors.expiration_year.message}
              </p>
            )}
          </div>
        </div>
      </FormSection>

      {creditCards.length > 0 && (
        <FormSection title={t('pages.storedCards.form.sectionLink')} icon={Link2}>
          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <Link2 className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.storedCards.form.financeCardLabel')}
            </Label>
            <Select
              value={watch('finance_card')?.toString() || 'none'}
              onValueChange={(value) =>
                setValue('finance_card', value === 'none' ? undefined : parseInt(value))
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('common.actions.none')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('common.actions.none')}</SelectItem>
                {creditCards.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id.toString()}>
                    {cc.name} - {cc.on_card_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {t('pages.storedCards.form.financeCardHint')}
            </p>
          </div>
        </FormSection>
      )}

      <FormSection title={t('pages.storedCards.form.sectionNotes')} icon={FileText}>
        <div className="space-y-sm">
          <Label htmlFor="notes" className="gap-xs flex items-center">
            <FileText className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.storedCards.form.notesLabel')}
          </Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder={t('pages.storedCards.form.notesPlaceholder')}
            rows={3}
            disabled={isLoading}
          />
          {errors.notes && (
            <p className="mt-xs text-destructive text-sm">{errors.notes.message}</p>
          )}
        </div>
      </FormSection>

      <div className="gap-sm pt-md flex justify-end border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-sm h-4 w-4 animate-spin" />
              {t('common.actions.saving')}
            </>
          ) : (
            t('common.actions.save')
          )}
        </Button>
      </div>
    </form>
  );
}
