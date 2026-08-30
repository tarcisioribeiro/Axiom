import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCircle2, ChevronRight, Mail, Settings, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { PageContainer } from '@/components/common/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmailVerificationSection } from '@/components/user-profile/EmailVerificationSection';
import { PasswordSection } from '@/components/user-profile/PasswordSection';
import { PersonalDataSection } from '@/components/user-profile/PersonalDataSection';
import { ProfileAvatar } from '@/components/user-profile/ProfileAvatar';
import { Section } from '@/components/user-profile/Section';
import { TwoFactorRow } from '@/components/user-profile/TwoFactorRow';
import { membersService } from '@/services/members-service';
import { useAuthStore } from '@/stores/auth-store';

export default function UserProfile() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: member } = useQuery({
    queryKey: ['members', 'me'],
    queryFn: () => membersService.getCurrentUserMember(),
  });

  const fullName = member?.name ?? user?.first_name ?? '';
  const email = member?.email ?? user?.email ?? '';
  const emailVerified = member?.email_verified ?? false;

  return (
    <PageContainer>
      <div className="mb-xl border-border/60 bg-card relative overflow-hidden rounded-2xl border">
        <div className="from-primary/8 to-primary/4 absolute inset-0 bg-gradient-to-br via-transparent" />
        <div className="bg-primary/5 absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl" />
        <div className="bg-primary/8 absolute -bottom-8 -left-8 h-32 w-32 rounded-full blur-2xl" />

        <div className="gap-md p-lg sm:gap-lg sm:p-xl relative flex flex-col sm:flex-row sm:items-center">
          <ProfileAvatar name={fullName} photoUrl={member?.profile_photo} />

          <div className="space-y-xs flex-1">
            <div className="gap-sm flex flex-wrap items-center">
              <h1 className="text-2xl font-bold tracking-tight">{fullName || '—'}</h1>
              {emailVerified && (
                <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/15">
                  <CheckCircle2 className="mr-xs h-3 w-3" />
                  Verificado
                </Badge>
              )}
            </div>
            {email && (
              <p className="gap-sm text-muted-foreground flex items-center text-sm">
                <Mail className="h-3.5 w-3.5" />
                {email}
              </p>
            )}
            <p className="gap-sm text-muted-foreground flex items-center text-xs">
              <Settings className="h-3 w-3" />
              {t('userProfile.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-lg">
        {member && <PersonalDataSection memberId={member.id} />}

        <EmailVerificationSection emailVerified={emailVerified} />

        <Section
          icon={<Shield className="h-4 w-4" />}
          title={t('userProfile.security.title')}
          description={t('userProfile.security.description')}
        >
          <TwoFactorRow />
          <div className="bg-border h-px" />
          <PasswordSection />
        </Section>

        <Section
          icon={<Bell className="h-4 w-4" />}
          title={t('pages.notificationPreferences.title')}
          description={t('pages.notificationPreferences.subtitle')}
        >
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {t('nav.notificationPreferences')}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void navigate('/settings/notifications')}
              className="gap-xs flex items-center"
            >
              {t('common.actions.edit')}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Section>
      </div>
    </PageContainer>
  );
}
