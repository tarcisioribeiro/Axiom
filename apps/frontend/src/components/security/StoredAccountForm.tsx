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
  Search,
} from 'lucide-react';
import { useState, useMemo } from 'react';
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
  { value: 'NUB', label: 'Nubank', ispb: '18236120' },
  { value: 'SIC', label: 'Sicoob', ispb: '00714671' },
  { value: 'MPG', label: 'Mercado Pago', ispb: '10573521' },
  { value: 'IFB', label: 'Ifood Benefícios', ispb: '' },
  { value: 'CEF', label: 'Caixa Econômica Federal', ispb: '00360305' },
  { value: 'BB', label: 'Banco do Brasil', ispb: '00000000' },
  { value: 'BRD', label: 'Bradesco', ispb: '60746948' },
  { value: 'ITA', label: 'Itaú', ispb: '60701190' },
  { value: 'SAN', label: 'Santander', ispb: '90400888' },
  { value: 'INT', label: 'Inter', ispb: '00416968' },
  { value: 'C6B', label: 'C6 Bank', ispb: '31872495' },
  { value: 'XPB', label: 'XP Investimentos', ispb: '02332886' },
  { value: 'BTG', label: 'BTG Pactual', ispb: '30306294' },
  { value: 'PAN', label: 'Banco PAN', ispb: '59285411' },
  { value: 'NXB', label: 'Next', ispb: '60746948' },
  { value: 'ORI', label: 'Banco Original', ispb: '92894922' },
  { value: 'PIC', label: 'Picpay', ispb: '22896431' },
  { value: 'REK', label: 'Reck', ispb: '' },
  { value: 'WIS', label: 'Wise', ispb: '' },
  { value: 'PAG', label: 'PagBank', ispb: '08561701' },
  { value: 'AVL', label: 'Agibank', ispb: '25228719' },
  { value: 'SIE', label: 'Sicredi', ispb: '01181521' },
  { value: 'ACR', label: 'Banco Ailos (ACRESCIMO)', ispb: '04902979' },
  { value: 'UNO', label: 'Unicred', ispb: '03046391' },
  { value: 'BAN', label: 'Banrisul', ispb: '92702067' },
  { value: 'SFN', label: 'Safra', ispb: '58160789' },
  { value: 'MOD', label: 'Modalmais', ispb: '30723886' },
  { value: 'TOT', label: 'Totvs Financial', ispb: '' },
  { value: 'REC', label: 'RecargaPay', ispb: '' },
  { value: 'OTH', label: 'Outro', ispb: '' },
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
  const [bankSearch, setBankSearch] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);

  const filteredInstitutions = useMemo(() => {
    if (!bankSearch) return INSTITUTIONS;
    const q = bankSearch.toLowerCase();
    return INSTITUTIONS.filter(
      (i) => i.label.toLowerCase().includes(q) || i.ispb.includes(q)
    );
  }, [bankSearch]);

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
          institution_code: account.institution_code || '',
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
          institution_code: '',
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
        <div className="gap-md grid grid-cols-1 md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="name" className="gap-xs flex items-center">
              <Building2 className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.storedAccounts.form.nameLabel')}
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder={t('pages.storedAccounts.form.namePlaceholder')}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="mt-xs text-destructive text-sm">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <Building2 className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.storedAccounts.form.institutionLabel')}
            </Label>
            <div className="relative">
              <button
                type="button"
                className="border-input bg-background ring-offset-background focus:ring-ring flex h-10 w-full cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2"
                onClick={() => setShowBankDropdown((v) => !v)}
              >
                {(() => {
                  const selected = INSTITUTIONS.find(
                    (i) => i.value === watch('institution_name')
                  );
                  if (selected) {
                    const InstIcon = INSTITUTION_ICONS[selected.value] ?? Building2;
                    return (
                      <span className="flex items-center gap-2">
                        <InstIcon className="h-4 w-4" />
                        {selected.label}
                      </span>
                    );
                  }
                  return (
                    <span className="text-muted-foreground">
                      {t('pages.storedAccounts.form.institutionPlaceholder')}
                    </span>
                  );
                })()}
              </button>

              {showBankDropdown && (
                <div className="border-border bg-popover absolute z-50 mt-1 w-full rounded-md border shadow-md">
                  <div className="gap-xs border-border p-sm flex items-center border-b">
                    <Search className="text-muted-foreground h-3.5 w-3.5" />
                    <input
                      className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
                      placeholder={t('pages.storedAccounts.form.bankSearchPlaceholder')}
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                    />
                  </div>
                  <div className="custom-scrollbar max-h-48 overflow-y-auto">
                    {filteredInstitutions.map((inst) => {
                      const InstIcon = INSTITUTION_ICONS[inst.value] ?? Building2;
                      return (
                        <button
                          key={inst.value}
                          type="button"
                          className="px-md py-sm hover:bg-muted flex w-full items-center gap-2 text-sm"
                          onClick={() => {
                            setValue('institution_name', inst.value);
                            setValue('institution_code', inst.ispb || '');
                            setBankSearch('');
                            setShowBankDropdown(false);
                          }}
                        >
                          <InstIcon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 text-left">{inst.label}</span>
                          {inst.ispb && (
                            <span className="text-muted-foreground text-xs">
                              {inst.ispb}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {filteredInstitutions.length === 0 && (
                      <p className="px-md py-sm text-muted-foreground text-sm">
                        {t('common.noResults')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {errors.institution_name && (
              <p className="mt-xs text-destructive text-sm">
                {errors.institution_name.message}
              </p>
            )}
            <input type="hidden" {...register('institution_code')} />
          </div>

          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <Building2 className="text-muted-foreground h-3.5 w-3.5" />
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
              <p className="mt-xs text-destructive text-sm">
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
        <div className="gap-md grid grid-cols-1 md:grid-cols-2">
          <div className="space-y-sm">
            <Label htmlFor="account_number" className="gap-xs flex items-center">
              <Hash className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.storedAccounts.form.numberLabel')}
            </Label>
            <Input
              id="account_number"
              {...register('account_number')}
              placeholder={t('pages.storedAccounts.form.numberPlaceholder')}
              disabled={isLoading}
            />
            {errors.account_number && (
              <p className="mt-xs text-destructive text-sm">
                {errors.account_number.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="agency" className="gap-xs flex items-center">
              <Hash className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.storedAccounts.form.agencyLabel')}
            </Label>
            <Input
              id="agency"
              {...register('agency')}
              placeholder={t('pages.storedAccounts.form.agencyPlaceholder')}
              disabled={isLoading}
            />
            {errors.agency && (
              <p className="mt-xs text-destructive text-sm">{errors.agency.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title={t('pages.storedAccounts.form.sectionPasswords')} icon={Lock}>
        <div className="gap-md grid">
          <div className="space-y-sm">
            <Label htmlFor="password" className="gap-xs flex items-center">
              <Lock className="text-muted-foreground h-3.5 w-3.5" />
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
                className="absolute top-0 right-0 h-full px-3"
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
              <p className="mt-xs text-destructive text-sm">
                {errors.password.message}
              </p>
            )}
            {account && (
              <p className="mt-xs text-warning text-xs">
                {t('pages.storedAccounts.form.keepCurrentPassword')}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="digital_password" className="gap-xs flex items-center">
              <Lock className="text-muted-foreground h-3.5 w-3.5" />
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
                className="absolute top-0 right-0 h-full px-3"
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
              <p className="mt-xs text-destructive text-sm">
                {errors.digital_password.message}
              </p>
            )}
          </div>
        </div>
      </FormSection>

      {financeAccounts.length > 0 && (
        <FormSection title={t('pages.storedAccounts.form.sectionLink')} icon={Link2}>
          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <Link2 className="text-muted-foreground h-3.5 w-3.5" />
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
            <p className="text-muted-foreground text-xs">
              {t('pages.storedAccounts.form.financeAccountHint')}
            </p>
          </div>
        </FormSection>
      )}

      <FormSection title={t('pages.storedAccounts.form.sectionNotes')} icon={FileText}>
        <div className="space-y-sm">
          <Label htmlFor="notes" className="gap-xs flex items-center">
            <FileText className="text-muted-foreground h-3.5 w-3.5" />
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
