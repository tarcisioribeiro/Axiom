import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Mail, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth-service';
import { getErrorMessage } from '@/utils/error-utils';

import { Section } from './Section';

export function EmailVerificationSection({
  emailVerified,
}: {
  emailVerified: boolean;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => authService.sendEmailVerification(),
    onSuccess: () => {
      toast({ title: t('userProfile.emailVerification.sent') });
    },
    onError: (err) => {
      toast({
        title: 'Erro',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    },
  });

  return (
    <Section
      icon={<Mail className="h-4 w-4" />}
      title={t('userProfile.emailVerification.title')}
      description={t('userProfile.emailVerification.description')}
    >
      <div className="flex items-center justify-between gap-md">
        <div className="flex items-center gap-3">
          {emailVerified ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Mail className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">
              {emailVerified
                ? t('userProfile.emailVerification.verified')
                : t('userProfile.emailVerification.unverified')}
            </p>
          </div>
        </div>
        <Badge
          variant={emailVerified ? 'default' : 'outline'}
          className={
            emailVerified ? 'bg-green-500/15 text-green-600 hover:bg-green-500/15' : ''
          }
        >
          {emailVerified ? 'Verificado' : 'Pendente'}
        </Badge>
      </div>

      {!emailVerified && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="gap-sm"
        >
          <Send className="h-4 w-4" />
          {mutation.isPending
            ? t('userProfile.emailVerification.sending')
            : t('userProfile.emailVerification.resend')}
        </Button>
      )}
    </Section>
  );
}
