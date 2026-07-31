import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link, useNavigate } from 'react-router';

import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useThemeAssets } from '@/hooks/use-theme-assets';
import { authService } from '@/services/auth-service';
import { getErrorMessage } from '@/utils/error-utils';

export default function ResetPassword() {
  const { t } = useTranslation();
  const { logo } = useThemeAssets();
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidParams = Boolean(uid && token);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !token) return;

    if (newPassword !== confirmPassword) {
      setError(t('auth.resetPassword.passwordMismatch'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authService.confirmPasswordReset(uid, token, newPassword, confirmPassword);
      setSuccess(true);
      setTimeout(() => void navigate('/login'), 3000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="from-background to-secondary/30 p-md relative flex min-h-screen items-center justify-center bg-gradient-to-br">
      <ThemeToggle className="absolute top-4 right-4" />

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-md text-center">
          <div className="mx-auto flex items-center justify-center">
            <img src={logo} alt="Axiom" className="h-auto w-64" />
          </div>
        </CardHeader>
        <CardContent>
          {!isValidParams ? (
            <div className="space-y-md text-center">
              <div className="border-destructive bg-destructive/10 px-md py-md rounded-lg border">
                <p className="text-destructive font-medium">
                  {t('auth.resetPassword.invalidLink')}
                </p>
                <p className="mt-xs text-destructive/80 text-sm">
                  {t('auth.resetPassword.invalidLinkDesc')}
                </p>
              </div>
              <Link
                to="/forgot-password"
                className="text-primary block text-sm font-medium hover:underline"
              >
                {t('auth.forgotPassword.title')}
              </Link>
            </div>
          ) : success ? (
            <div className="space-y-md text-center">
              <div className="px-md py-md rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                <p className="font-medium text-green-800 dark:text-green-300">
                  {t('auth.resetPassword.successTitle')}
                </p>
                <p className="mt-xs text-sm text-green-700 dark:text-green-400">
                  {t('auth.resetPassword.successDesc')}
                </p>
              </div>
              <Link
                to="/login"
                className="text-primary block text-sm font-medium hover:underline"
              >
                {t('auth.resetPassword.goToLogin')}
              </Link>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-md">
              <p className="text-muted-foreground text-center text-sm">
                {t('auth.resetPassword.description')}
              </p>

              {error && (
                <div className="border-destructive bg-destructive/10 px-md text-destructive rounded-lg border py-3 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-sm">
                <Label htmlFor="new-password">
                  {t('auth.resetPassword.newPassword')}
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
                  required
                  minLength={8}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-sm">
                <Label htmlFor="confirm-password">
                  {t('auth.resetPassword.confirmPassword')}
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
                  required
                  minLength={8}
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="gradient-primary w-full font-semibold text-white"
                disabled={isLoading || !newPassword || !confirmPassword}
              >
                {isLoading
                  ? t('auth.resetPassword.loading')
                  : t('auth.resetPassword.submit')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
