import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlainButton } from '@/components/ui/plain-button';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth-service';
import { getErrorMessage } from '@/utils/error-utils';

export function DisableTwoFactor({ onDisabled }: { onDisabled: () => void }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const mutation = useMutation({
    mutationFn: (pw: string) => authService.disableTwoFactor(pw),
    onSuccess: () => {
      toast({ title: t('pages.twoFactor.disableSuccess') });
      onDisabled();
    },
    onError: (error: unknown) => {
      toast({
        title: t('pages.twoFactor.disableError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(password);
      }}
      className="gap-md flex flex-1 flex-col"
    >
      {/* Campo centralizado no espaço restante; botão logo abaixo. */}
      <div className="relative m-auto w-full max-w-xs">
        <Input
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          aria-label={t('userProfile.security.currentPassword')}
          placeholder={t('common.placeholders.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
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
      <Button
        type="submit"
        variant="destructive"
        loading={mutation.isPending}
        className="self-end"
      >
        {!mutation.isPending && <ShieldOff />}
        {mutation.isPending
          ? t('pages.twoFactor.verifying')
          : t('pages.twoFactor.disableBtn')}
      </Button>
    </form>
  );
}
