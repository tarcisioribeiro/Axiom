/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BadgeDollarSign,
  Building2,
  CreditCard,
  Hash,
  Landmark,
  ShieldAlert,
} from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
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
import { TRANSLATIONS, translate } from '@/config/constants';
import {
  ACCOUNT_TYPE_ICONS as ACCOUNT_TYPE_ICONS_CONFIG,
  INSTITUTION_ICONS as INSTITUTION_ICONS_CONFIG,
} from '@/config/icons';
import { logger } from '@/lib/logger';
import { accountSchema, type AccountFormData } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import type { Account } from '@/types';

interface AccountFormProps {
  account?: Account;
  members?: Array<{ id: number; name: string }>;
  onSubmit: (data: AccountFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const AccountForm: React.FC<AccountFormProps> = ({
  account,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: account
      ? {
          account_name: account.account_name,
          account_type: account.account_type as AccountFormData['account_type'],
          institution: account.institution as AccountFormData['institution'],
          account_number: '',
          balance: parseFloat(account.balance),
          overdraft_limit: account.overdraft_limit
            ? parseFloat(account.overdraft_limit)
            : 0,
          owner: account.owner,
        }
      : {
          account_name: '',
          account_type: 'CC',
          institution: 'NUB',
          account_number: '',
          balance: 0,
          overdraft_limit: 0,
          owner: 0,
        },
  });

  useEffect(() => {
    const loadCurrentUserMember = async () => {
      try {
        const member = await membersService.getCurrentUserMember();
        setValue('owner', member.id);
      } catch (error) {
        logger.error('Erro ao carregar membro do usuário:', error);
      }
    };

    void loadCurrentUserMember();
  }, [setValue]);

  const accountType = watch('account_type') || 'CC';
  const institution = watch('institution') || 'NUB';
  const balanceVal = watch('balance') ?? 0;
  const overdraftVal = watch('overdraft_limit') ?? 0;

  const balanceAccent =
    balanceVal > 0 ? 'success' : balanceVal < 0 ? 'destructive' : 'default';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-lg">
      {/* Mini preview da conta */}
      <div className="relative overflow-hidden rounded-lg border border-border/60 bg-gradient-to-br from-muted/40 to-muted/10 p-md">
        <div className="flex items-center gap-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            {(() => {
              const InstIcon = INSTITUTION_ICONS_CONFIG[institution] ?? Building2;
              return <InstIcon className="h-5 w-5 text-primary" />;
            })()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">
              {watch('account_name') || t('pages.accounts.form.namePlaceholder')}
            </p>
            <p className="text-xs text-muted-foreground">
              {TRANSLATIONS.institutions[
                institution as keyof typeof TRANSLATIONS.institutions
              ] ?? institution}
              {accountType ? ` · ${translate('accountTypes', accountType)}` : ''}
            </p>
          </div>
          <div
            className={`text-right ${balanceVal >= 0 ? 'text-success' : 'text-destructive'}`}
          >
            <p className="text-xs text-muted-foreground">
              {t('common.fields.balance')}
            </p>
            <p className="font-semibold">
              {balanceVal.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </p>
          </div>
        </div>
        <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-primary/5" />
      </div>

      {/* Seção: Identificação */}
      <FormSection title={t('common.form.sections.basicInfo')} icon={Landmark}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label className="flex items-center gap-xs">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.accounts.form.typeLabel')}
            </Label>
            <div className="grid grid-cols-3 gap-xs">
              {Object.entries(TRANSLATIONS.accountTypes).map(([key]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setValue('account_type', key as AccountFormData['account_type'])
                  }
                  disabled={isLoading}
                  className={`flex items-center gap-xs rounded border px-sm py-xs text-xs font-medium transition-all ${
                    accountType === key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {(() => {
                    const TypeIcon = ACCOUNT_TYPE_ICONS_CONFIG[key] ?? Building2;
                    return <TypeIcon className="h-4 w-4 shrink-0" />;
                  })()}
                  <span className="truncate">{translate('accountTypes', key)}</span>
                </button>
              ))}
            </div>
            {errors.account_type && (
              <p className="text-sm text-destructive">{errors.account_type.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="institution" className="flex items-center gap-xs">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.accounts.form.institutionLabel')}
            </Label>
            <Select
              value={institution}
              onValueChange={(value) =>
                setValue('institution', value as AccountFormData['institution'])
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t('pages.accounts.form.institutionPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TRANSLATIONS.institutions).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      {(() => {
                        const InstIcon = INSTITUTION_ICONS_CONFIG[key] ?? Building2;
                        return <InstIcon className="h-4 w-4" />;
                      })()}
                      {value}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.institution && (
              <p className="text-sm text-destructive">{errors.institution.message}</p>
            )}
          </div>

          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="account_name" className="flex items-center gap-xs">
              <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.accounts.form.nameLabel')}
            </Label>
            <Input
              id="account_name"
              {...register('account_name')}
              placeholder={t('pages.accounts.form.namePlaceholder')}
              disabled={isLoading}
            />
            {errors.account_name && (
              <p className="text-sm text-destructive">{errors.account_name.message}</p>
            )}
          </div>

          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="account_number" className="flex items-center gap-xs">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.accounts.form.numberLabel')}
            </Label>
            <Input
              id="account_number"
              {...register('account_number')}
              placeholder={
                account
                  ? t('pages.accounts.form.numberHiddenPlaceholder')
                  : t('pages.accounts.form.numberPlaceholder')
              }
              disabled={isLoading}
            />
            {account && (
              <p className="text-xs text-muted-foreground">
                {t('pages.accounts.form.numberHiddenPlaceholder')}
              </p>
            )}
            {errors.account_number && (
              <p className="text-sm text-destructive">
                {errors.account_number.message}
              </p>
            )}
          </div>
        </div>
      </FormSection>

      {/* Seção: Valores */}
      <FormSection title={t('common.form.sections.values')} icon={BadgeDollarSign}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm">
            <Label htmlFor="balance" className="flex items-center gap-xs">
              <BadgeDollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.accounts.form.balanceLabel')}
            </Label>
            <CurrencyInput
              id="balance"
              accentColor={balanceAccent}
              value={balanceVal}
              onChange={(e) => setValue('balance', parseFloat(e.target.value) || 0)}
              disabled={isLoading}
            />
            {overdraftVal > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('pages.accounts.form.balanceMinHint')}{' '}
                {(-overdraftVal).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            )}
            {errors.balance && (
              <p className="text-sm text-destructive">{errors.balance.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="overdraft_limit" className="flex items-center gap-xs">
              <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.accounts.form.overdraftLabel')}
              <span className="ml-1 text-xs text-muted-foreground/70">
                ({t('common.actions.none').toLowerCase()})
              </span>
            </Label>
            <CurrencyInput
              id="overdraft_limit"
              value={overdraftVal}
              onChange={(e) =>
                setValue('overdraft_limit', parseFloat(e.target.value) || 0)
              }
              disabled={isLoading}
            />
            {errors.overdraft_limit && (
              <p className="text-sm text-destructive">
                {errors.overdraft_limit.message}
              </p>
            )}
          </div>
        </div>
      </FormSection>

      <div className="flex justify-end gap-sm pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? t('common.actions.saving')
            : account
              ? t('common.actions.update')
              : t('common.actions.create')}
        </Button>
      </div>
    </form>
  );
};
