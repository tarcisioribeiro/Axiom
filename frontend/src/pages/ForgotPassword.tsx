import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useThemeAssets } from '@/hooks/use-theme-assets';
import { authService } from '@/services/auth-service';
import { getErrorMessage } from '@/utils/error-utils';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { logo } = useThemeAssets();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await authService.requestPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-md">
      <ThemeToggle className="absolute right-4 top-4" />

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-md text-center">
          <div className="mx-auto flex items-center justify-center">
            <img src={logo} alt="Axiom" className="h-auto w-64" />
          </div>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-md text-center">
              <div className="rounded-lg border border-green-200 bg-green-50 px-md py-md dark:border-green-800 dark:bg-green-950/30">
                <p className="font-medium text-green-800 dark:text-green-300">
                  {t('auth.forgotPassword.successTitle')}
                </p>
                <p className="mt-xs text-sm text-green-700 dark:text-green-400">
                  {t('auth.forgotPassword.successDesc')}
                </p>
              </div>
              <Link
                to="/login"
                className="block text-sm font-medium text-primary hover:underline"
              >
                {t('auth.forgotPassword.backToLogin')}
              </Link>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-md">
              <p className="text-center text-sm text-muted-foreground">
                {t('auth.forgotPassword.description')}
              </p>

              {error && (
                <div className="rounded-lg border border-destructive bg-destructive/10 px-md py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-sm">
                <Label htmlFor="email">{t('auth.forgotPassword.emailLabel')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.forgotPassword.emailPlaceholder')}
                  required
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="gradient-primary w-full font-semibold text-white"
                disabled={isLoading || !email}
              >
                {isLoading
                  ? t('auth.forgotPassword.loading')
                  : t('auth.forgotPassword.submit')}
              </Button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm text-muted-foreground hover:underline"
                >
                  {t('auth.forgotPassword.backToLogin')}
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
