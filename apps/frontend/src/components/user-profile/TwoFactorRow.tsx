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

import { PasswordSection } from './PasswordSection';

export function TwoFactorRow() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['2fa', 'status'],
    queryFn: () => authService.getTwoFactorStatus(),
  });

  const isActive = data?.is_active ?? false;

  return (
    <div className="gap-md flex flex-wrap items-center justify-between">
      <div className="flex items-center gap-3">
        {isActive ? (
          <ShieldCheck className="text-success h-5 w-5" />
        ) : (
          <ShieldOff className="text-muted-foreground h-5 w-5" />
        )}
        <p className="text-sm font-medium">{t('userProfile.security.twoFactor')}</p>
      </div>
      <div className="gap-sm ml-auto flex flex-wrap items-center justify-end">
        <Badge variant={isActive ? 'success' : 'outline'}>
          {isActive
            ? t('userProfile.security.twoFactorActive')
            : t('userProfile.security.twoFactorInactive')}
        </Badge>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Settings />
          {t('userProfile.security.twoFactorManage')}
        </Button>
        <PasswordSection />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Altura fixa: igual em todas as etapas e cabe a mais alta (QR Code). */}
        <DialogContent size="sm" className="h-[32rem] max-w-lg grid-rows-[auto_1fr]">
          <DialogHeader>
            <DialogTitle>{t('pages.twoFactor.title')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col">
            <TwoFactorManager onDisabled={() => setOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
