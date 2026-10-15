import { UserPlus, UserX } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router';

import { AccountFields } from '@/components/auth/AccountFields';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { useRegistrationStatus } from '@/hooks/use-registration-status';
import { useThemeAssets } from '@/hooks/use-theme-assets';
import { useToast } from '@/hooks/use-toast';
import { toAccountPayload, type AccountFormData } from '@/lib/account-form';
import { notifyFormErrors } from '@/lib/form-errors';
import { authService } from '@/services/auth-service';

export default function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { logo } = useThemeAssets();
  const form = useForm<AccountFormData>();
  const { data: registration } = useRegistrationStatus();

  const onSubmit = async (data: AccountFormData) => {
    try {
      setIsLoading(true);
      await authService.register(toAccountPayload(data));
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

          {registration?.open === false ? (
            <EmptyState icon={<UserX />} title={t('auth.register.closed')} />
          ) : (
            <form
              onSubmit={form.handleSubmit(onSubmit, notifyFormErrors)}
              className="space-y-md"
              noValidate
            >
              <AccountFields form={form} disabled={isLoading} />

              <Button type="submit" className="w-full" loading={isLoading}>
                {!isLoading && <UserPlus aria-hidden="true" />}
                {isLoading ? t('auth.register.loading') : t('auth.register.submit')}
              </Button>
            </form>
          )}

          <div className="mt-lg text-center text-sm">
            {registration?.open !== false && (
              <span>{t('auth.register.hasAccount')} </span>
            )}
            <Link to="/login" className="text-primary font-medium hover:underline">
              {registration?.open === false
                ? t('auth.register.backToLogin')
                : t('auth.register.login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
