import { useMutation } from '@tanstack/react-query';
import { ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-sm text-destructive">
          <ShieldOff className="h-5 w-5" />
          {t('pages.twoFactor.disableBtn')}
        </CardTitle>
        <CardDescription>{t('pages.twoFactor.disableDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(password);
          }}
          className="flex gap-3"
        >
          <Input
            type="password"
            placeholder={t('userProfile.security.currentPassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="max-w-xs"
          />
          <Button type="submit" variant="destructive" disabled={mutation.isPending}>
            {mutation.isPending
              ? t('pages.twoFactor.verifying')
              : t('pages.twoFactor.disableBtn')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
