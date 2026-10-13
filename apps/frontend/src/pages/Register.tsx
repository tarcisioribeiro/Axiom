/* eslint-disable max-lines */
import { AtSign, IdCard, Mail, Phone, User, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  FieldRow,
  PasswordField,
  Rule,
} from '@/components/user-profile/PasswordSection';
import { PasswordStrength } from '@/components/user-profile/PasswordStrength';
import { useThemeAssets } from '@/hooks/use-theme-assets';
import { useToast } from '@/hooks/use-toast';
import { notifyFormErrors } from '@/lib/form-errors';
import { getPasswordScore, useStrengthScorer } from '@/lib/password-strength';
import { authService } from '@/services/auth-service';

const formatCpf = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

interface RegisterFormData {
  username: string;
  password: string;
  confirmPassword: string;
  name: string;
  document: string;
  phone: string;
  email?: string;
}

export default function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { logo } = useThemeAssets();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterFormData>();

  const scorer = useStrengthScorer();
  const password = useWatch({ control, name: 'password' }) ?? '';
  const confirmPassword = useWatch({ control, name: 'confirmPassword' }) ?? '';

  // Mesmas regras da troca de senha no perfil (espelham AUTH_PASSWORD_VALIDATORS)
  const hasMinLength = password.length >= 8;
  const notOnlyNumbers = password.length > 0 && !/^\d+$/.test(password);
  const matches = confirmPassword.length > 0 && confirmPassword === password;

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsLoading(true);
      await authService.register({
        username: data.username,
        password: data.password,
        name: data.name,
        document: data.document.replace(/\D/g, ''),
        phone: data.phone.replace(/\D/g, ''),
        email: data.email,
      });

      toast({
        title: t('auth.register.successDesc'),
      });

      void navigate('/login');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : t('auth.register.errorDesc');
      toast({
        title: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="from-primary/10 via-background to-accent/10 p-md flex min-h-screen items-center justify-center bg-gradient-to-br">
      <div className="w-full max-w-2xl">
        <div className="bg-card p-xl rounded-2xl border">
          <div className="mb-xl text-center">
            <div className="mx-auto flex items-center justify-center">
              <img src={logo} alt="Axiom" className="h-auto w-48" />
            </div>
            <p className="mt-sm">{t('auth.register.subtitle')}</p>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit, notifyFormErrors)}
            className="space-y-md"
            noValidate
          >
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
                  disabled={isLoading}
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
                      v.replace(/\D/g, '').length === 11 ||
                      t('auth.register.cpfDigits'),
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
                      disabled={isLoading}
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
              >
                <Input
                  type="email"
                  {...register('email', {
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: t('auth.register.emailInvalid'),
                    },
                  })}
                  placeholder={t('auth.register.emailPlaceholder')}
                  disabled={isLoading}
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
                      v.replace(/\D/g, '').length >= 10 ||
                      t('auth.register.phoneInvalid'),
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
                      disabled={isLoading}
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
                disabled={isLoading}
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
                      disabled={isLoading}
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
                    validate: (v) =>
                      v === password || t('auth.register.passwordsMismatch'),
                  }}
                  render={({ field }) => (
                    <PasswordField
                      id="confirmPassword"
                      invalid={!!errors.confirmPassword}
                      placeholder={t('auth.register.passwordPlaceholder')}
                      disabled={isLoading}
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

            <Button type="submit" className="w-full" loading={isLoading}>
              {!isLoading && <UserPlus aria-hidden="true" />}
              {isLoading ? t('auth.register.loading') : t('auth.register.submit')}
            </Button>
          </form>

          <div className="mt-lg text-center text-sm">
            <span>{t('auth.register.hasAccount')} </span>
            <Link to="/login" className="text-primary font-medium hover:underline">
              {t('auth.register.login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
