import { useMutation } from '@tanstack/react-query';
import { ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth-service';
import { getErrorMessage } from '@/utils/error-utils';

export function DisableTwoFactor({ onDisabled }: { onDisabled: () => void }) {
  const [password, setPassword] = useState('');
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
        title: t('pages.twoFactor.wrongPassword'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(password);
      }}
      className="space-y-3"
    >
      <p className="text-muted-foreground text-sm">
        {t('pages.twoFactor.disableDesc')}
      </p>
      <div className="flex flex-wrap gap-3">
        <Input
          type="password"
          autoComplete="current-password"
          aria-label={t('userProfile.security.currentPassword')}
          placeholder={t('userProfile.security.currentPassword')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="max-w-xs"
        />
        <Button type="submit" variant="destructive" loading={mutation.isPending}>
          {!mutation.isPending && <ShieldOff />}
          {mutation.isPending
            ? t('pages.twoFactor.verifying')
            : t('pages.twoFactor.disableBtn')}
        </Button>
      </div>
    </form>
  );
}
