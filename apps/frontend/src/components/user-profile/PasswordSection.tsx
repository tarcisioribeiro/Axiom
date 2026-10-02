import { useMutation } from '@tanstack/react-query';
import { Check, Eye, EyeOff, KeyRound, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlainButton } from '@/components/ui/plain-button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { authService } from '@/services/auth-service';
import { getErrorMessage } from '@/utils/error-utils';

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-sm">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-9"
        />
        <PlainButton
          aria-label={t(show ? 'auth.login.hidePassword' : 'auth.login.showPassword')}
          type="button"
          onClick={() => setShow((v) => !v)}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </PlainButton>
      </div>
    </div>
  );
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li
      className={cn(
        'gap-xs flex items-center text-xs',
        ok ? 'text-success' : 'text-muted-foreground'
      )}
    >
      {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {children}
    </li>
  );
}

export function PasswordSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  // Espelha os validadores do Django (AUTH_PASSWORD_VALIDATORS); senha comum ou
  // parecida com os dados do usuário só o backend consegue recusar.
  const hasMinLength = next.length >= 8;
  const notOnlyNumbers = next.length > 0 && !/^\d+$/.test(next);
  const matches = confirm.length > 0 && confirm === next;

  const mutation = useMutation({
    mutationFn: () => authService.changePassword(current, next, confirm),
    onSuccess: () => {
      toast({ title: t('userProfile.security.passwordSuccess') });
      setCurrent('');
      setNext('');
      setConfirm('');
    },
    onError: (err) => {
      toast({
        title: t('userProfile.security.passwordError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    },
  });

  return (
    <form
      className="space-y-md"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <p className="text-sm font-medium">{t('userProfile.security.changePassword')}</p>
      <PasswordField
        id="current-pw"
        label={t('userProfile.security.currentPassword')}
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
      />
      <PasswordField
        id="new-pw"
        label={t('userProfile.security.newPassword')}
        value={next}
        onChange={setNext}
        autoComplete="new-password"
      />
      <ul className="space-y-xs">
        <Rule ok={hasMinLength}>{t('userProfile.security.rules.minLength')}</Rule>
        <Rule ok={notOnlyNumbers}>{t('userProfile.security.rules.notNumeric')}</Rule>
      </ul>
      <PasswordField
        id="confirm-pw"
        label={t('userProfile.security.confirmPassword')}
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />
      <ul>
        <Rule ok={matches}>{t('userProfile.security.rules.matches')}</Rule>
      </ul>
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="outline"
          loading={mutation.isPending}
          disabled={!current || !hasMinLength || !notOnlyNumbers || !matches}
        >
          {!mutation.isPending && <KeyRound />}
          {mutation.isPending
            ? t('userProfile.security.savingPassword')
            : t('userProfile.security.savePassword')}
        </Button>
      </div>
    </form>
  );
}
