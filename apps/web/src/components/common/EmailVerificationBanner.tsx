import { useQuery } from '@tanstack/react-query';
import { MailWarning, Send, X } from 'lucide-react';
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
        title: t('common.emailVerificationBanner.sentDesc'),
      });
    } catch (error: unknown) {
      toast({
        title: t('common.emailVerificationBanner.errorTitle', {
          reason: getErrorMessage(error),
        }),
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Pílula na barra superior (Header): não ocupa altura da página (§6, sem rolagem).
  return (
    <div className="gap-xs border-warning/40 bg-warning/10 py-xs pl-sm flex shrink-0 items-center rounded-full border pr-0.5 text-xs">
      <MailWarning className="text-warning h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="text-foreground hidden font-medium whitespace-nowrap lg:inline">
        {t('common.emailVerificationBanner.short')}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleResend}
        loading={isSending}
        title={t('common.emailVerificationBanner.resend')}
        tooltipSide="bottom"
        className="h-6 w-6"
      >
        {!isSending && <Send className="h-3.5 w-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setDismissed(true)}
        title={t('common.emailVerificationBanner.dismiss')}
        tooltipSide="bottom"
        className="h-6 w-6"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
