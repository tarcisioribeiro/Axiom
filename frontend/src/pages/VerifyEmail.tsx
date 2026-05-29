import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';

import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { useThemeAssets } from '@/hooks/use-theme-assets';
import { authService } from '@/services/auth-service';
import { useAuthStore } from '@/stores/auth-store';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmail() {
  const { t } = useTranslation();
  const { logo } = useThemeAssets();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();

  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'error');

  useEffect(() => {
    if (!token) return;

    void authService
      .confirmEmailVerification(token)
      .then(() => {
        setStatus('success');
        // Se autenticado, redireciona para home após 3s
        if (isAuthenticated) {
          setTimeout(() => void navigate('/'), 3000);
        }
      })
      .catch(() => {
        setStatus('error');
      });
  }, [token, navigate, isAuthenticated]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-md">
      <ThemeToggle className="absolute right-4 top-4" />

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-md text-center">
          <div className="mx-auto flex items-center justify-center">
            <img src={logo} alt="Axiom" className="h-auto w-64" />
          </div>
        </CardHeader>
        <CardContent className="space-y-md text-center">
          {status === 'verifying' && (
            <div className="flex flex-col items-center gap-md py-md">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {t('auth.verifyEmail.verifying')}
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-md py-md">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">
                  {t('auth.verifyEmail.successTitle')}
                </p>
                <p className="mt-xs text-sm text-muted-foreground">
                  {t('auth.verifyEmail.successDesc')}
                </p>
              </div>
              <Button
                className="gradient-primary font-semibold text-white"
                onClick={() => void navigate(isAuthenticated ? '/' : '/login')}
              >
                {isAuthenticated
                  ? t('auth.verifyEmail.goToHome')
                  : t('auth.login.submit')}
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-md py-md">
              <XCircle className="h-10 w-10 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">
                  {t('auth.verifyEmail.errorTitle')}
                </p>
                <p className="mt-xs text-sm text-muted-foreground">
                  {t('auth.verifyEmail.errorDesc')}
                </p>
              </div>
              <Link
                to="/login"
                className="text-sm font-medium text-primary hover:underline"
              >
                {t('auth.verifyEmail.backToLogin')}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
