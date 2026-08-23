import {
  ShieldCheckIcon as ShieldCheck,
  ShieldExclamationIcon as ShieldOff,
} from '@heroicons/react/24/solid';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/auth-service';

export function TwoFactorRow() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['2fa', 'status'],
    queryFn: () => authService.getTwoFactorStatus(),
  });

  const isActive = data?.is_active ?? false;

  return (
    <div className="gap-md flex items-center justify-between">
      <div className="flex items-center gap-3">
        {isActive ? (
          <ShieldCheck className="h-5 w-5 text-green-500" />
        ) : (
          <ShieldOff className="text-muted-foreground h-5 w-5" />
        )}
        <div>
          <p className="text-sm font-medium">{t('userProfile.security.twoFactor')}</p>
          <p className="text-muted-foreground text-xs">
            {t('userProfile.security.twoFactorDesc')}
          </p>
        </div>
      </div>
      <div className="gap-sm flex shrink-0 items-center">
        <Badge
          variant={isActive ? 'default' : 'outline'}
          className={
            isActive ? 'bg-green-500/15 text-green-600 hover:bg-green-500/15' : ''
          }
        >
          {isActive
            ? t('userProfile.security.twoFactorActive')
            : t('userProfile.security.twoFactorInactive')}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void navigate('/settings/two-factor')}
        >
          {t('userProfile.security.twoFactorManage')}
        </Button>
      </div>
    </div>
  );
}
