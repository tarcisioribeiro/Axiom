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
    >
      {emailVerified ? (
        <Badge className="bg-success text-success-foreground hover:bg-success border-transparent">
          <CheckCircle2 className="mr-xs h-3 w-3" />
          Verificado
        </Badge>
      ) : (
        <div className="gap-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="text-muted-foreground h-5 w-5" />
            <p className="text-sm font-medium">
              {t('userProfile.emailVerification.unverified')}
            </p>
          </div>
          <Badge variant="warning">Pendente</Badge>
        </div>
      )}

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
