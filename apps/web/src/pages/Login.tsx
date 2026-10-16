/* eslint-disable max-lines */
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import {
  AlertTriangle,
  AtSign,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router';

import { AppVersionBadge } from '@/components/common/AppVersionBadge';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlainButton } from '@/components/ui/plain-button';
import { useCapsLock } from '@/hooks/use-caps-lock';
import { useRegistrationStatus } from '@/hooks/use-registration-status';
import { useThemeAssets } from '@/hooks/use-theme-assets';
import { toast } from '@/hooks/use-toast';
import { transitions } from '@/lib/animations';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

// Troca entre senha e 2FA: entra pelo lado da navegação, sai pelo oposto
const stepVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -24,
    transition: transitions.fast,
  }),
};

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { capsLockOn, inputProps: capsLockProps } = useCapsLock();
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const { login, verify2FA, isLoading, requires2FA } = useAuthStore();
  const { logo } = useThemeAssets();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: registration } = useRegistrationStatus();

  // A mensagem vem do store (login/verify2FA preenchem `error`)
  const showError = () => {
    const message = useAuthStore.getState().error;
    if (message) toast({ title: message, variant: 'destructive' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ username, password });
      if (!useAuthStore.getState().requires2FA) {
        void navigate('/');
      }
    } catch {
      showError();
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verify2FA(twoFactorCode);
      // Sessão 2FA expirada: o store define `error` sem lançar exceção
      if (useAuthStore.getState().error) {
        showError();
        return;
      }
      void navigate('/');
    } catch {
      showError();
    }
  };

  // Avança (1) ao entrar no 2FA, recua (-1) ao voltar para a senha
  const direction = requires2FA ? 1 : -1;

  // Etapa 2FA
  const twoFactorCard = (
    <Card className="flex min-h-[34rem] w-full flex-col justify-center">
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
        </div>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={handleVerify2FA} className="space-y-md">
          <div className="space-y-sm">
            <Label className="gap-xs flex items-center" htmlFor="twoFactorCode">
              <ShieldCheck className="text-muted-foreground h-3.5 w-3.5" />
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
          </div>
          <Button
            type="submit"
            className="w-full"
            loading={isLoading}
            disabled={twoFactorCode.length < 6}
          >
            {!isLoading && <ShieldCheck aria-hidden="true" />}
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
              setUsername('');
              setPassword('');
              setShowPassword(false);
            }}
            className="text-muted-foreground hover:text-primary text-sm hover:underline"
          >
            {t('auth.twoFactor.back', { defaultValue: '← Voltar ao login' })}
          </button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="bg-muted/30 p-md relative flex min-h-screen items-center justify-center">
      <ThemeToggle className="absolute top-4 right-4" />
      <AppVersionBadge className="absolute right-4 bottom-4" />

      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={requires2FA ? 'two-factor' : 'password'}
          custom={direction}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="w-full max-w-md"
        >
          {requires2FA ? (
            twoFactorCard
          ) : (
            <Card className="flex min-h-[34rem] w-full flex-col justify-center">
              <CardHeader className="space-y-md text-center">
                <div className="mx-auto flex items-center justify-center">
                  <img src={logo} alt="Axiom" className="h-auto w-64" />
                </div>
              </CardHeader>
              <CardContent>
                <form noValidate onSubmit={handleSubmit} className="space-y-md">
                  <div className="space-y-sm">
                    <Label className="gap-xs flex items-center" htmlFor="username">
                      <AtSign className="text-muted-foreground h-3.5 w-3.5" />
                      {t('auth.login.username')}
                    </Label>
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
                    <Label className="gap-xs flex items-center" htmlFor="password">
                      <Lock className="text-muted-foreground h-3.5 w-3.5" />
                      {t('auth.login.password')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        {...capsLockProps}
                        aria-describedby={capsLockOn ? 'caps-lock-warning' : undefined}
                        placeholder={t('auth.login.passwordPlaceholder')}
                        required
                        disabled={isLoading}
                        className="pr-10"
                      />
                      <PlainButton
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
                      </PlainButton>
                    </div>
                    {/* Espaço sempre reservado para o aviso não alterar a altura do card */}
                    <p
                      id="caps-lock-warning"
                      role="status"
                      aria-hidden={!capsLockOn}
                      className={cn(
                        'text-warning gap-xs flex h-5 items-center text-sm',
                        !capsLockOn && 'invisible'
                      )}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      {t('auth.login.capsLockOn')}
                    </p>
                  </div>

                  <Button type="submit" className="w-full" loading={isLoading}>
                    {!isLoading && <LogIn aria-hidden="true" />}
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

                {registration?.open && (
                  <div className="mt-md text-center text-sm">
                    <span>{t('auth.login.noAccount')} </span>
                    <Link
                      to="/register"
                      className="text-primary font-medium hover:underline"
                    >
                      {t('auth.login.register')}
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
