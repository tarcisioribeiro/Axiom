import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';

import { AppVersionBadge } from '@/components/common/AppVersionBadge';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useThemeAssets } from '@/hooks/use-theme-assets';
import { useAuthStore } from '@/stores/auth-store';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const { login, verify2FA, isLoading, error, requires2FA } = useAuthStore();
  const { logo } = useThemeAssets();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ username, password });
      if (!useAuthStore.getState().requires2FA) {
        void navigate('/');
      }
    } catch {
      // Error handled by store
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verify2FA(twoFactorCode);
      void navigate('/');
    } catch {
      // Error handled by store
    }
  };

  // Etapa 2FA
  if (requires2FA) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-md">
        <ThemeToggle className="absolute right-4 top-4" />
        <AppVersionBadge className="absolute bottom-4 right-4" />
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-md text-center">
            <div className="mx-auto flex items-center justify-center">
              <img src={logo} alt="Axiom" className="h-auto w-64" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                {t('auth.twoFactor.title', {
                  defaultValue: 'Verificação em duas etapas',
                })}
              </h2>
              <p className="mt-xs text-sm text-muted-foreground">
                {t('auth.twoFactor.description', {
                  defaultValue: 'Digite o código do seu aplicativo autenticador.',
                })}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify2FA} className="space-y-md">
              {error && (
                <div className="rounded-lg border border-destructive bg-destructive/10 px-md py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-sm">
                <Label htmlFor="twoFactorCode">
                  {t('auth.twoFactor.codeLabel', {
                    defaultValue: 'Código de verificação',
                  })}
                </Label>
                <Input
                  id="twoFactorCode"
                  type="text"
                  inputMode="numeric"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="000000"
                  maxLength={10}
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  {t('auth.twoFactor.backupHint', {
                    defaultValue: 'Você também pode usar um código de backup.',
                  })}
                </p>
              </div>
              <Button
                type="submit"
                className="gradient-primary w-full font-semibold text-white"
                disabled={isLoading || twoFactorCode.length < 6}
              >
                {isLoading
                  ? t('auth.twoFactor.loading', { defaultValue: 'Verificando...' })
                  : t('auth.twoFactor.submit', { defaultValue: 'Verificar' })}
              </Button>
            </form>
            <div className="mt-md text-center">
              <button
                type="button"
                onClick={() => {
                  useAuthStore.setState({
                    requires2FA: false,
                    tempToken: null,
                    error: null,
                  });
                  setTwoFactorCode('');
                }}
                className="text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                {t('auth.twoFactor.back', { defaultValue: '← Voltar ao login' })}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-md">
      <ThemeToggle className="absolute right-4 top-4" />
      <AppVersionBadge className="absolute bottom-4 right-4" />

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-md text-center">
          <div className="mx-auto flex items-center justify-center">
            <img src={logo} alt="Axiom" className="h-auto w-64" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-md">
            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 px-md py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-sm">
              <Label htmlFor="username">{t('auth.login.username')}</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('auth.login.usernamePlaceholder')}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-sm">
              <Label htmlFor="password">{t('auth.login.password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.login.passwordPlaceholder')}
                required
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="gradient-primary w-full font-semibold text-white"
              disabled={isLoading}
            >
              {isLoading ? t('auth.login.loading') : t('auth.login.submit')}
            </Button>
          </form>

          <div className="mt-md text-center">
            <Link
              to="/forgot-password"
              className="text-sm text-muted-foreground hover:text-primary hover:underline"
            >
              {t('auth.login.forgotPassword')}
            </Link>
          </div>

          <div className="mt-md text-center text-sm">
            <span>{t('auth.login.noAccount')} </span>
            <Link to="/register" className="font-medium text-primary hover:underline">
              {t('auth.login.register')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
