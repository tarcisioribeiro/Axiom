import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
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
          account_number: '', // Can't show encrypted number
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

  // Buscar o membro do usuário logado automaticamente
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-md">
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <div className="space-y-sm">
          <Label htmlFor="account_type">{t('pages.accounts.form.typeLabel')}</Label>
          <Select
            value={accountType}
            onValueChange={(value) =>
              setValue('account_type', value as AccountFormData['account_type'])
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t('pages.accounts.form.typePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TRANSLATIONS.accountTypes).map(([key]) => (
                <SelectItem key={key} value={key}>
                  {translate('accountTypes', key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.account_type && (
            <p className="text-sm text-destructive">{errors.account_type.message}</p>
          )}
        </div>

        <div className="space-y-sm">
          <Label htmlFor="institution">
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
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.institution && (
            <p className="text-sm text-destructive">{errors.institution.message}</p>
          )}
        </div>

        <div className="space-y-sm">
          <Label htmlFor="account_name">{t('pages.accounts.form.nameLabel')}</Label>
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

        <div className="space-y-sm">
          <Label htmlFor="account_number">{t('pages.accounts.form.numberLabel')}</Label>
          <Input
            id="account_number"
            {...register('account_number')}
            placeholder={t('pages.accounts.form.numberPlaceholder')}
            disabled={isLoading}
          />
          {errors.account_number && (
            <p className="text-sm text-destructive">{errors.account_number.message}</p>
          )}
        </div>

        <div className="space-y-sm">
          <Label htmlFor="balance">{t('pages.accounts.form.balanceLabel')}</Label>
          <Input
            id="balance"
            type="number"
            step="0.01"
            {...register('balance', { valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
          {watch('overdraft_limit') > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('pages.accounts.form.balanceMinHint')}{' '}
              {(-watch('overdraft_limit')).toLocaleString('pt-BR', {
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
          <Label htmlFor="overdraft_limit">
            {t('pages.accounts.form.overdraftLabel')}
          </Label>
          <Input
            id="overdraft_limit"
            type="number"
            step="0.01"
            {...register('overdraft_limit', { valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
          {errors.overdraft_limit && (
            <p className="text-sm text-destructive">{errors.overdraft_limit.message}</p>
          )}
        </div>
      </div>

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
