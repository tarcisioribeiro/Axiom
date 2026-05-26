/* eslint-disable max-lines */
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
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
  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<RegisterFormData>();

  const password = watch('password');

  const onSubmit = async (data: RegisterFormData) => {
    if (data.password !== data.confirmPassword) {
      toast({
        title: t('auth.register.errorTitle'),
        description: t('auth.register.passwordsMismatch'),
        variant: 'destructive',
      });
      return;
    }

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
        title: t('auth.register.successTitle'),
        description: t('auth.register.successDesc'),
      });

      void navigate('/login');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : t('auth.register.errorDesc');
      toast({
        title: t('auth.register.errorTitle'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-md">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border bg-card p-xl shadow-2xl">
          <div className="mb-xl text-center">
            <h1 className="gradient-primary bg-clip-text text-3xl font-bold text-transparent">
              Axiom
            </h1>
            <p className="mt-sm">{t('auth.register.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-md" noValidate>
            <FormField
              id="name"
              label={t('auth.register.fullName')}
              error={errors.name?.message}
              required
            >
              <Input
                type="text"
                {...register('name', { required: t('auth.register.fullNameRequired') })}
                placeholder={t('auth.register.fullNamePlaceholder')}
                disabled={isLoading}
              />
            </FormField>

            <FormField
              id="document"
              label={t('auth.register.cpf')}
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
                    placeholder={t('auth.register.cpfPlaceholder')}
                    maxLength={14}
                    disabled={isLoading}
                  />
                )}
              />
            </FormField>

            <FormField
              id="phone"
              label={t('auth.register.phone')}
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
                    placeholder={t('auth.register.phonePlaceholder')}
                    maxLength={15}
                    disabled={isLoading}
                  />
                )}
              />
            </FormField>

            <FormField
              id="email"
              label={t('auth.register.email')}
              error={errors.email?.message}
              description={t('auth.register.emailHint')}
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
              id="username"
              label={t('auth.register.username')}
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

            <FormField
              id="password"
              label={t('auth.register.password')}
              error={errors.password?.message}
              required
            >
              <Input
                type="password"
                {...register('password', {
                  required: t('auth.register.passwordRequired'),
                  minLength: {
                    value: 6,
                    message: t('auth.register.passwordMinLength'),
                  },
                })}
                placeholder={t('auth.register.passwordPlaceholder')}
                disabled={isLoading}
              />
            </FormField>

            <FormField
              id="confirmPassword"
              label={t('auth.register.confirmPassword')}
              error={errors.confirmPassword?.message}
              required
            >
              <Input
                type="password"
                {...register('confirmPassword', {
                  required: t('auth.register.confirmPasswordRequired'),
                  validate: (value) =>
                    value === password || t('auth.register.passwordsMismatch'),
                })}
                placeholder={t('auth.register.passwordPlaceholder')}
                disabled={isLoading}
              />
            </FormField>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-sm h-4 w-4 animate-spin" />
                  {t('auth.register.loading')}
                </>
              ) : (
                t('auth.register.submit')
              )}
            </Button>
          </form>

          <div className="mt-lg text-center text-sm">
            <span>{t('auth.register.hasAccount')} </span>
            <Link to="/login" className="font-medium text-primary hover:underline">
              {t('auth.register.login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
