import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth-service';
import { getErrorMessage } from '@/utils/error-utils';

export function PasswordSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);

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
    <div className="space-y-3">
      <p className="text-sm font-medium">{t('userProfile.security.changePassword')}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="current-pw">
            {t('userProfile.security.currentPassword')}
          </Label>
          <div className="relative mt-xs">
            <Input
              id="current-pw"
              type={showCurrent ? 'text' : 'password'}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showCurrent ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        <div>
          <Label htmlFor="new-pw">{t('userProfile.security.newPassword')}</Label>
          <div className="relative mt-xs">
            <Input
              id="new-pw"
              type={showNext ? 'text' : 'password'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowNext((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <Label htmlFor="confirm-pw">
            {t('userProfile.security.confirmPassword')}
          </Label>
          <Input
            id="confirm-pw"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-xs"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !current || !next || !confirm}
          className="gap-sm"
        >
          <KeyRound className="h-4 w-4" />
          {mutation.isPending
            ? t('userProfile.security.savingPassword')
            : t('userProfile.security.savePassword')}
        </Button>
      </div>
    </div>
  );
}
