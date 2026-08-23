import {
  EyeIcon as Eye,
  EyeSlashIcon as EyeOff,
  ShieldCheckIcon as ShieldCheck,
} from '@heroicons/react/24/solid';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router';

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
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="bg-muted/30 p-md relative flex min-h-screen items-center justify-center">
        <ThemeToggle className="absolute top-4 right-4" />
        <AppVersionBadge className="absolute right-4 bottom-4" />
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-md text-center">
            <div className="bg-primary/10 ring-primary/20 mx-auto flex h-14 w-14 items-center justify-center rounded-full ring-1 ring-inset">
              <ShieldCheck className="text-primary h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <div className="mb-xs gap-xs flex items-center justify-center">
                <span className="bg-muted px-sm text-muted-foreground rounded-full py-0.5 text-xs">
                  {t('auth.twoFactor.step', { defaultValue: 'Etapa 2 de 2' })}
                </span>
              </div>
              <h2 className="text-xl font-semibold">
                {t('auth.twoFactor.title', {
                  defaultValue: 'Verificação em duas etapas',
                })}
              </h2>
              <p className="mt-xs text-muted-foreground text-sm">
                {t('auth.twoFactor.description', {
                  defaultValue: 'Digite o código do seu aplicativo autenticador.',
                })}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify2FA} className="space-y-md">
              {error && (
                <div className="border-destructive bg-destructive/10 px-md text-destructive rounded-lg border py-3 text-sm">
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
                <p className="text-muted-foreground text-xs">
                  {t('auth.twoFactor.backupHint', {
                    defaultValue: 'Você também pode usar um código de backup.',
                  })}
                </p>
              </div>
              <Button
                type="submit"
                className="w-full"
                loading={isLoading}
                disabled={twoFactorCode.length < 6}
              >
                {t('auth.twoFactor.submit', { defaultValue: 'Verificar' })}
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
                className="text-muted-foreground hover:text-primary text-sm hover:underline"
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
    <div className="bg-muted/30 p-md relative flex min-h-screen items-center justify-center">
      <ThemeToggle className="absolute top-4 right-4" />
      <AppVersionBadge className="absolute right-4 bottom-4" />

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-md text-center">
          <div className="mx-auto flex items-center justify-center">
            <img src={logo} alt="Axiom" className="h-auto w-64" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-md">
            {error && (
              <div className="border-destructive bg-destructive/10 px-md text-destructive rounded-lg border py-3 text-sm">
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
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.login.passwordPlaceholder')}
                  required
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                  aria-label={
                    showPassword
                      ? t('auth.login.hidePassword')
                      : t('auth.login.showPassword')
                  }
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" loading={isLoading}>
              {t('auth.login.submit')}
            </Button>
          </form>

          <div className="mt-md text-center">
            <Link
              to="/forgot-password"
              className="text-muted-foreground hover:text-primary text-sm hover:underline"
            >
              {t('auth.login.forgotPassword')}
            </Link>
          </div>

          <div className="mt-md text-center text-sm">
            <span>{t('auth.login.noAccount')} </span>
            <Link to="/register" className="text-primary font-medium hover:underline">
              {t('auth.login.register')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
