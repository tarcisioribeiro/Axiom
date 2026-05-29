import { useQuery } from '@tanstack/react-query';
import { MailWarning, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api-client';
import { authService } from '@/services/auth-service';
import { useAuthStore } from '@/stores/auth-store';
import { getErrorMessage } from '@/utils/error-utils';

interface MeResponse {
  member?: {
    email?: string | null;
    email_verified?: boolean;
  } | null;
}

export function EmailVerificationBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isAuthenticated, isAdmin } = useAuthStore();

  const { data } = useQuery<MeResponse>({
    queryKey: ['me', 'email-verified'],
    queryFn: () => apiClient.get<MeResponse>('/api/v1/me/'),
    enabled: isAuthenticated && !isAdmin,
    staleTime: 60_000,
  });

  const emailVerified = data?.member?.email_verified;
  const hasEmail = !!data?.member?.email;

  // Não exibir se: email verificado, sem email, usuário admin, não autenticado, ou dispensado
  if (
    !isAuthenticated ||
    isAdmin ||
    dismissed ||
    emailVerified !== false ||
    !hasEmail
  ) {
    return null;
  }

  const handleResend = async () => {
    setIsSending(true);
    try {
      await authService.sendEmailVerification();
      toast({
        title: t('common.emailVerificationBanner.sentTitle'),
        description: t('common.emailVerificationBanner.sentDesc'),
      });
    } catch (error: unknown) {
      toast({
        title: t('common.emailVerificationBanner.errorTitle'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-md py-3 text-sm">
      <MailWarning className="h-4 w-4 shrink-0 text-warning" />
      <span className="flex-1 text-foreground">
        {t('common.emailVerificationBanner.message')}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={handleResend}
        disabled={isSending}
        className="shrink-0 border-warning/40 text-xs hover:bg-warning/10"
      >
        {isSending
          ? t('common.emailVerificationBanner.sending')
          : t('common.emailVerificationBanner.resend')}
      </Button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        aria-label={t('common.emailVerificationBanner.dismiss')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
