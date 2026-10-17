/* eslint-disable max-lines */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Eye, EyeOff, KeyRound, Lock, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlainButton } from '@/components/ui/plain-button';
import { useCapsLock } from '@/hooks/use-caps-lock';
import { useToast } from '@/hooks/use-toast';
import { getPasswordScore, useStrengthScorer } from '@/lib/password-strength';
import { cn } from '@/lib/utils';
import { ValidationError } from '@/services/api-errors';
import { authService } from '@/services/auth-service';
import { getErrorMessage } from '@/utils/error-utils';

import { PasswordStrength } from './PasswordStrength';

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  warnCapsLock,
  invalid,
  placeholder,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  error?: string;
  /** Mostra o aviso de Caps Lock do login abaixo do campo. */
  warnCapsLock?: boolean;
  /** Borda vermelha sem texto abaixo (erro já vai para toast). */
  invalid?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const { capsLockOn, inputProps: capsLockProps } = useCapsLock();
  const describedBy = error
    ? `${id}-error`
    : warnCapsLock && capsLockOn
      ? `${id}-caps`
      : undefined;

  return (
    <div className="space-y-sm">
      <Label htmlFor={id} className="gap-xs flex items-center">
        <Lock className="text-muted-foreground h-3.5 w-3.5" />
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...(warnCapsLock ? capsLockProps : {})}
          aria-invalid={error || invalid ? true : undefined}
          placeholder={placeholder ?? t('common.placeholders.password')}
          disabled={disabled}
          aria-describedby={describedBy}
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
      {error && (
        <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {/* Espaço sempre reservado para o aviso não alterar a altura do formulário */}
      {warnCapsLock && (
        <p
          id={`${id}-caps`}
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
      )}
    </div>
  );
}

/** Linha do formulário: campo à esquerda, avisos à direita (centralizados). */
export function FieldRow({
  field,
  aside,
}: {
  field: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="gap-md grid sm:grid-cols-2 sm:items-center">
      {field}
      {aside && (
        <div className="gap-xs flex flex-col items-center justify-center">{aside}</div>
      )}
    </div>
  );
}

export function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
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

// Escala 0-4 do zxcvbn guardada no membro → rótulo e cor do badge.
const STRENGTH_BADGES = [
  { key: 'veryWeak', variant: 'destructive' },
  { key: 'weak', variant: 'warning' },
  { key: 'medium', variant: 'info' },
  { key: 'strong', variant: 'default' },
  { key: 'veryStrong', variant: 'success' },
] as const;

export function PasswordRow({ strength }: { strength?: number | null }) {
  const { t } = useTranslation();
  const badge = strength == null ? undefined : STRENGTH_BADGES[strength];

  return (
    <div className="space-y-md">
      <div className="gap-sm flex flex-wrap items-center">
        <KeyRound className="text-muted-foreground h-5 w-5" />
        <p className="text-sm font-medium">{t('userProfile.security.password')}</p>
        <Badge className="ml-auto" variant={badge?.variant ?? 'outline'}>
          {t(`userProfile.security.strengthBadge.${badge?.key ?? 'unknown'}`)}
        </Badge>
      </div>
      <PasswordSection />
    </div>
  );
}

export function PasswordSection() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <KeyRound />
        {t('userProfile.security.changePassword')}
      </Button>
      {/* Fechar desmonta o formulário, o que já zera os campos. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm" className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="gap-sm flex items-center">
              <KeyRound className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
              {t('userProfile.security.changePassword')}
            </DialogTitle>
          </DialogHeader>
          <PasswordForm onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function PasswordForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scorer = useStrengthScorer();
  const [current, setCurrent] = useState('');
  const [currentError, setCurrentError] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  // Espelha os validadores do Django (AUTH_PASSWORD_VALIDATORS); senha comum ou
  // parecida com os dados do usuário só o backend consegue recusar.
  const hasMinLength = next.length >= 8;
  const notOnlyNumbers = next.length > 0 && !/^\d+$/.test(next);
  const matches = confirm.length > 0 && confirm === next;
  const strengthScore = getPasswordScore(next, scorer);

  const mutation = useMutation({
    mutationFn: () => authService.changePassword(current, next, confirm),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members', 'me'] });
      toast({ title: t('userProfile.security.passwordSuccess') });
      onClose();
    },
    onError: (err) => {
      // O backend responde { error } quando a senha atual está errada e
      // { error, details } quando os validadores do Django recusam a nova senha.
      const data: Record<string, unknown> =
        err instanceof ValidationError ? err.errors : {};
      const details = Array.isArray(data.details) ? data.details.join(' ') : '';
      if (!details && typeof data.error === 'string') {
        setCurrentError(data.error);
        return;
      }
      toast({
        title: t('userProfile.security.passwordError', {
          reason: details || getErrorMessage(err),
        }),
        variant: 'destructive',
      });
    },
  });

  return (
    <form
      noValidate
      className="gap-md flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <FieldRow
        field={
          <PasswordField
            id="current-pw"
            label={t('userProfile.security.currentPassword')}
            value={current}
            onChange={(value) => {
              setCurrent(value);
              setCurrentError('');
            }}
            autoComplete="current-password"
            warnCapsLock
            error={currentError}
          />
        }
      />
      <FieldRow
        field={
          <PasswordField
            id="new-pw"
            label={t('userProfile.security.newPassword')}
            value={next}
            onChange={setNext}
            autoComplete="new-password"
            warnCapsLock
          />
        }
        aside={
          next && (
            <>
              <PasswordStrength score={strengthScore} />
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
          <PasswordField
            id="confirm-pw"
            label={t('userProfile.security.confirmPassword')}
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            warnCapsLock
          />
        }
        aside={
          confirm && (
            <ul>
              <Rule ok={matches}>{t('userProfile.security.rules.matches')}</Rule>
            </ul>
          )
        }
      />
      <div className="gap-sm mt-auto flex justify-end">
        <Button type="button" variant="outline" onClick={onClose}>
          <X />
          {t('common.actions.cancel')}
        </Button>
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
