import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { storedAccountSchema, type StoredBankAccountFormData } from '@/lib/validations';
import type { StoredBankAccount, Account, Member } from '@/types';

const ACCOUNT_TYPES = [
  { value: 'CC', label: 'Conta Corrente' },
  { value: 'CS', label: 'Conta Salário' },
  { value: 'CP', label: 'Conta Poupança' },
  { value: 'CI', label: 'Conta Investimento' },
  { value: 'OTHER', label: 'Outro' },
];

// Mapeamento de instituições do módulo financeiro (backend)
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
          password: '', // Não carregar senha por segurança
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">{t('pages.storedAccounts.form.nameLabel')}</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder={t('pages.storedAccounts.form.namePlaceholder')}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="institution_name">
            {t('pages.storedAccounts.form.institutionLabel')}
          </Label>
          <Select
            value={watch('institution_name') || ''}
            onValueChange={(value) => setValue('institution_name', value)}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={t('pages.storedAccounts.form.institutionPlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              {INSTITUTIONS.map((inst) => (
                <SelectItem key={inst.value} value={inst.value}>
                  {inst.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.institution_name && (
            <p className="mt-1 text-sm text-destructive">
              {errors.institution_name.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="account_type">
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
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.account_type && (
            <p className="mt-1 text-sm text-destructive">
              {errors.account_type.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="account_number">
            {t('pages.storedAccounts.form.numberLabel')}
          </Label>
          <Input
            id="account_number"
            {...register('account_number')}
            placeholder={t('pages.storedAccounts.form.numberPlaceholder')}
          />
          {errors.account_number && (
            <p className="mt-1 text-sm text-destructive">
              {errors.account_number.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="agency">{t('pages.storedAccounts.form.agencyLabel')}</Label>
          <Input
            id="agency"
            {...register('agency')}
            placeholder={t('pages.storedAccounts.form.agencyPlaceholder')}
          />
          {errors.agency && (
            <p className="mt-1 text-sm text-destructive">{errors.agency.message}</p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="password">
            {t('pages.storedAccounts.form.password1Label')}
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              placeholder={
                account ? 'Deixe vazio para manter a atual' : 'Senha do app/site'
              }
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
            <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>
          )}
          {account && (
            <p className="mt-1 text-xs text-warning">
              Deixe vazio para manter a senha atual (criptografada)
            </p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="digital_password">
            {t('pages.storedAccounts.form.password2Label')}
          </Label>
          <div className="relative">
            <Input
              id="digital_password"
              type={showSecondPassword ? 'text' : 'password'}
              {...register('digital_password')}
              placeholder={
                account ? 'Deixe vazio para manter a atual' : 'Senha do cartão'
              }
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
            <p className="mt-1 text-sm text-destructive">
              {errors.digital_password.message}
            </p>
          )}
        </div>

        {financeAccounts.length > 0 && (
          <div className="col-span-2">
            <Label htmlFor="finance_account">
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
            <p className="mt-1 text-xs">
              {t('pages.storedAccounts.form.financeAccountHint')}
            </p>
          </div>
        )}

        <div className="col-span-2">
          <Label htmlFor="notes">{t('pages.storedAccounts.form.notesLabel')}</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder={t('pages.storedAccounts.form.notesPlaceholder')}
            rows={3}
          />
          {errors.notes && (
            <p className="mt-1 text-sm text-destructive">{errors.notes.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
