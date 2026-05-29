/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Building2,
  Eye,
  EyeOff,
  FileText,
  Hash,
  Link2,
  Loader2,
  Lock,
} from 'lucide-react';
import { useState } from 'react';
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
import { STORED_ACCOUNT_TYPE_ICONS, INSTITUTION_ICONS } from '@/config/icons';
import { storedAccountSchema, type StoredBankAccountFormData } from '@/lib/validations';
import type { StoredBankAccount, Account, Member } from '@/types';

const ACCOUNT_TYPE_VALUES = ['CC', 'CS', 'CP', 'CI', 'OTHER'] as const;

const INSTITUTIONS = [
  { value: 'NUB', label: 'Nubank' },
  { value: 'SIC', label: 'Sicoob' },
  { value: 'MPG', label: 'Mercado Pago' },
  { value: 'IFB', label: 'Ifood Benefícios' },
  { value: 'CEF', label: 'Caixa Econômica Federal' },
];

interface StoredAccountFormProps {
  account?: StoredBankAccount;
  financeAccounts?: Account[];
  currentMember: Member | null;
  onSubmit: (data: StoredBankAccountFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function StoredAccountForm({
  account,
  financeAccounts = [],
  currentMember,
  onSubmit,
  onCancel,
  isLoading = false,
}: StoredAccountFormProps) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [showSecondPassword, setShowSecondPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StoredBankAccountFormData>({
    resolver: zodResolver(storedAccountSchema),
    defaultValues: account
      ? {
          name: account.name,
          institution_name: account.institution_name,
          account_type:
            account.account_type as StoredBankAccountFormData['account_type'],
          account_number: account.account_number || '',
          agency: account.agency || '',
          password: '',
          digital_password: '',
          notes: account.notes || '',
          owner: account.owner,
          finance_account: account.finance_account || undefined,
        }
      : {
          name: '',
          institution_name: '',
          account_type: 'CC',
          account_number: '',
          agency: '',
          password: '',
          digital_password: '',
          notes: '',
          owner: currentMember?.id || 0,
          finance_account: undefined,
        },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-lg">
      <FormSection
        title={t('pages.storedAccounts.form.sectionIdentification')}
        icon={Building2}
      >
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="name" className="flex items-center gap-xs">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.storedAccounts.form.nameLabel')}
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder={t('pages.storedAccounts.form.namePlaceholder')}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="mt-xs text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.storedAccounts.form.institutionLabel')}
            </Label>
            <Select
              value={watch('institution_name') || ''}
              onValueChange={(value) => setValue('institution_name', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t('pages.storedAccounts.form.institutionPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {INSTITUTIONS.map((inst) => (
                  <SelectItem key={inst.value} value={inst.value}>
                    <span className="flex items-center gap-2">
                      {(() => {
                        const InstIcon = INSTITUTION_ICONS[inst.value] ?? Building2;
                        return <InstIcon className="h-4 w-4" />;
                      })()}
                      {inst.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.institution_name && (
              <p className="mt-xs text-sm text-destructive">
                {errors.institution_name.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.storedAccounts.form.typeLabel')}
            </Label>
            <Select
              value={watch('account_type')}
              onValueChange={(value) =>
                setValue(
                  'account_type',
                  value as StoredBankAccountFormData['account_type']
                )
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPE_VALUES.map((value) => {
                  const TypeIcon = STORED_ACCOUNT_TYPE_ICONS[value] ?? Building2;
                  return (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4" />
                        {t(`pages.storedAccounts.accountTypes.${value}`)}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {errors.account_type && (
              <p className="mt-xs text-sm text-destructive">
                {errors.account_type.message}
              </p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection
        title={t('pages.storedAccounts.form.sectionAccountData')}
        icon={Hash}
      >
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm">
            <Label htmlFor="account_number" className="flex items-center gap-xs">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.storedAccounts.form.numberLabel')}
            </Label>
            <Input
              id="account_number"
              {...register('account_number')}
              placeholder={t('pages.storedAccounts.form.numberPlaceholder')}
              disabled={isLoading}
            />
            {errors.account_number && (
              <p className="mt-xs text-sm text-destructive">
                {errors.account_number.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="agency" className="flex items-center gap-xs">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.storedAccounts.form.agencyLabel')}
            </Label>
            <Input
              id="agency"
              {...register('agency')}
              placeholder={t('pages.storedAccounts.form.agencyPlaceholder')}
              disabled={isLoading}
            />
            {errors.agency && (
              <p className="mt-xs text-sm text-destructive">{errors.agency.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title={t('pages.storedAccounts.form.sectionPasswords')} icon={Lock}>
        <div className="grid gap-md">
          <div className="space-y-sm">
            <Label htmlFor="password" className="flex items-center gap-xs">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.storedAccounts.form.password1Label')}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                placeholder={
                  account
                    ? t('pages.storedAccounts.form.password1EditPlaceholder')
                    : t('pages.storedAccounts.form.password1Placeholder')
                }
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.password && (
              <p className="mt-xs text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
            {account && (
              <p className="mt-xs text-xs text-warning">
                {t('pages.storedAccounts.form.keepCurrentPassword')}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="digital_password" className="flex items-center gap-xs">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.storedAccounts.form.password2Label')}
            </Label>
            <div className="relative">
              <Input
                id="digital_password"
                type={showSecondPassword ? 'text' : 'password'}
                {...register('digital_password')}
                placeholder={
                  account
                    ? t('pages.storedAccounts.form.password2EditPlaceholder')
                    : t('pages.storedAccounts.form.password2Placeholder')
                }
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowSecondPassword(!showSecondPassword)}
              >
                {showSecondPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.digital_password && (
              <p className="mt-xs text-sm text-destructive">
                {errors.digital_password.message}
              </p>
            )}
          </div>
        </div>
      </FormSection>

      {financeAccounts.length > 0 && (
        <FormSection title={t('pages.storedAccounts.form.sectionLink')} icon={Link2}>
          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.storedAccounts.form.financeAccountLabel')}
            </Label>
            <Select
              value={watch('finance_account')?.toString() || 'none'}
              onValueChange={(value) =>
                setValue(
                  'finance_account',
                  value === 'none' ? undefined : parseInt(value)
                )
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('common.actions.none')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('common.actions.none')}</SelectItem>
                {financeAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id.toString()}>
                    {acc.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('pages.storedAccounts.form.financeAccountHint')}
            </p>
          </div>
        </FormSection>
      )}

      <FormSection title={t('pages.storedAccounts.form.sectionNotes')} icon={FileText}>
        <div className="space-y-sm">
          <Label htmlFor="notes" className="flex items-center gap-xs">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            {t('pages.storedAccounts.form.notesLabel')}
          </Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder={t('pages.storedAccounts.form.notesPlaceholder')}
            rows={3}
            disabled={isLoading}
          />
          {errors.notes && (
            <p className="mt-xs text-sm text-destructive">{errors.notes.message}</p>
          )}
        </div>
      </FormSection>

      <div className="flex justify-end gap-sm border-t pt-md">
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
