import { AtSign, IdCard, Mail, Phone, User } from 'lucide-react';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  FieldRow,
  PasswordField,
  Rule,
} from '@/components/user-profile/PasswordSection';
import { PasswordStrength } from '@/components/user-profile/PasswordStrength';
import { formatCpf, formatPhone, type AccountFormData } from '@/lib/account-form';
import { getPasswordScore, useStrengthScorer } from '@/lib/password-strength';

interface AccountFieldsProps {
  form: UseFormReturn<AccountFormData>;
  disabled: boolean;
}

/** Campos de conta compartilhados pelo cadastro e pelo modal "Novo staff". */
export function AccountFields({ form, disabled }: AccountFieldsProps) {
  const { t } = useTranslation();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const scorer = useStrengthScorer();
  const password = useWatch({ control, name: 'password' }) ?? '';
  const confirmPassword = useWatch({ control, name: 'confirmPassword' }) ?? '';

  // Mesmas regras da troca de senha no perfil (espelham AUTH_PASSWORD_VALIDATORS)
  const hasMinLength = password.length >= 8;
  const notOnlyNumbers = password.length > 0 && !/^\d+$/.test(password);
  const matches = confirmPassword.length > 0 && confirmPassword === password;

  return (
    <>
      <div className="gap-md grid sm:grid-cols-2">
        <FormField
          id="name"
          label={t('auth.register.fullName')}
          icon={User}
          error={errors.name?.message}
          required
        >
          <Input
            type="text"
            {...register('name', {
              required: t('auth.register.fullNameRequired'),
            })}
            placeholder={t('auth.register.fullNamePlaceholder')}
            disabled={disabled}
          />
        </FormField>

        <FormField
          id="document"
          label={t('auth.register.cpf')}
          icon={IdCard}
          error={errors.document?.message}
          required
        >
          <Controller
            control={control}
            name="document"
            rules={{
              required: t('auth.register.cpfRequired'),
              validate: (v) =>
                v.replace(/\D/g, '').length === 11 || t('auth.register.cpfDigits'),
            }}
            render={({ field }) => (
              <Input
                id="document"
                type="text"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(formatCpf(e.target.value))}
                onBlur={field.onBlur}
                ref={field.ref}
                aria-invalid={!!errors.document}
                placeholder={t('auth.register.cpfPlaceholder')}
                maxLength={14}
                disabled={disabled}
              />
            )}
          />
        </FormField>
      </div>

      <div className="gap-md grid sm:grid-cols-2">
        <FormField
          id="email"
          label={t('auth.register.email')}
          icon={Mail}
          error={errors.email?.message}
          required
        >
          <Input
            type="email"
            {...register('email', {
              required: t('auth.register.emailRequired'),
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: t('auth.register.emailInvalid'),
              },
            })}
            placeholder={t('auth.register.emailPlaceholder')}
            disabled={disabled}
          />
        </FormField>

        <FormField
          id="phone"
          label={t('auth.register.phone')}
          icon={Phone}
          error={errors.phone?.message}
          required
        >
          <Controller
            control={control}
            name="phone"
            rules={{
              required: t('auth.register.phoneRequired'),
              validate: (v) =>
                v.replace(/\D/g, '').length >= 10 || t('auth.register.phoneInvalid'),
            }}
            render={({ field }) => (
              <Input
                id="phone"
                type="tel"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(formatPhone(e.target.value))}
                onBlur={field.onBlur}
                ref={field.ref}
                aria-invalid={!!errors.phone}
                placeholder={t('auth.register.phonePlaceholder')}
                maxLength={15}
                disabled={disabled}
              />
            )}
          />
        </FormField>
      </div>

      <FormField
        id="username"
        label={t('auth.register.username')}
        icon={AtSign}
        error={errors.username?.message}
        required
      >
        <Input
          type="text"
          {...register('username', {
            required: t('auth.register.usernameRequired'),
            minLength: {
              value: 3,
              message: t('auth.register.usernameMinLength'),
            },
          })}
          placeholder={t('auth.register.usernamePlaceholder')}
          disabled={disabled}
        />
      </FormField>

      <FieldRow
        field={
          <Controller
            control={control}
            name="password"
            rules={{
              required: t('auth.register.passwordRequired'),
              validate: {
                minLength: (v) =>
                  v.length >= 8 || t('userProfile.security.rules.minLength'),
                notNumeric: (v) =>
                  !/^\d+$/.test(v) || t('userProfile.security.rules.notNumeric'),
              },
            }}
            render={({ field }) => (
              <PasswordField
                id="password"
                invalid={!!errors.password}
                placeholder={t('auth.register.passwordPlaceholder')}
                disabled={disabled}
                label={t('auth.register.password')}
                value={field.value ?? ''}
                onChange={field.onChange}
                autoComplete="new-password"
                warnCapsLock
              />
            )}
          />
        }
        aside={
          password && (
            <>
              <PasswordStrength score={getPasswordScore(password, scorer)} />
              <ul className="space-y-xs">
                <Rule ok={hasMinLength}>
                  {t('userProfile.security.rules.minLength')}
                </Rule>
                <Rule ok={notOnlyNumbers}>
                  {t('userProfile.security.rules.notNumeric')}
                </Rule>
              </ul>
            </>
          )
        }
      />

      <FieldRow
        field={
          <Controller
            control={control}
            name="confirmPassword"
            rules={{
              required: t('auth.register.confirmPasswordRequired'),
              validate: (v) => v === password || t('auth.register.passwordsMismatch'),
            }}
            render={({ field }) => (
              <PasswordField
                id="confirmPassword"
                invalid={!!errors.confirmPassword}
                placeholder={t('auth.register.passwordPlaceholder')}
                disabled={disabled}
                label={t('auth.register.confirmPassword')}
                value={field.value ?? ''}
                onChange={field.onChange}
                autoComplete="new-password"
                warnCapsLock
              />
            )}
          />
        }
        aside={
          confirmPassword && (
            <ul>
              <Rule ok={matches}>{t('userProfile.security.rules.matches')}</Rule>
            </ul>
          )
        }
      />
    </>
  );
}
