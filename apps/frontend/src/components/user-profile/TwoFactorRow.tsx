import { useQuery } from '@tanstack/react-query';
import { Settings, ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TwoFactorManager } from '@/components/two-factor/TwoFactorManager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { authService } from '@/services/auth-service';

export function TwoFactorRow() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['2fa', 'status'],
    queryFn: () => authService.getTwoFactorStatus(),
  });

  const isActive = data?.is_active ?? false;

  return (
    <div className="gap-md flex items-center justify-between">
      <div className="flex items-center gap-3">
        {isActive ? (
          <ShieldCheck className="text-success h-5 w-5" />
        ) : (
          <ShieldOff className="text-muted-foreground h-5 w-5" />
        )}
        <p className="text-sm font-medium">{t('userProfile.security.twoFactor')}</p>
      </div>
      <div className="gap-sm flex shrink-0 items-center">
        <Badge variant={isActive ? 'success' : 'outline'}>
          {isActive
            ? t('userProfile.security.twoFactorActive')
            : t('userProfile.security.twoFactorInactive')}
        </Badge>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Settings />
          {t('userProfile.security.twoFactorManage')}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t('pages.twoFactor.title')}</DialogTitle>
          </DialogHeader>
          <TwoFactorManager onDisabled={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
