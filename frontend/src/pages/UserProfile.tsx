import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Mail, Settings, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { Badge } from '@/components/ui/badge';
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

  const { data: member } = useQuery({
    queryKey: ['members', 'me'],
    queryFn: () => membersService.getCurrentUserMember(),
  });

  const fullName = member?.name ?? user?.first_name ?? '';
  const email = member?.email ?? user?.email ?? '';
  const emailVerified = member?.email_verified ?? false;

  return (
    <PageContainer>
      <div className="relative mb-xl overflow-hidden rounded-2xl border border-border/60 bg-card">
        <div className="from-primary/8 to-primary/4 absolute inset-0 bg-gradient-to-br via-transparent" />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
        <div className="bg-primary/8 absolute -bottom-8 -left-8 h-32 w-32 rounded-full blur-2xl" />

        <div className="relative flex flex-col gap-md p-lg sm:flex-row sm:items-center sm:gap-lg sm:p-xl">
          <ProfileAvatar name={fullName} photoUrl={member?.profile_photo} />

          <div className="flex-1 space-y-xs">
            <div className="flex flex-wrap items-center gap-sm">
              <h1 className="text-2xl font-bold tracking-tight">{fullName || '—'}</h1>
              {emailVerified && (
                <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/15">
                  <CheckCircle2 className="mr-xs h-3 w-3" />
                  Verificado
                </Badge>
              )}
            </div>
            {email && (
              <p className="flex items-center gap-sm text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {email}
              </p>
            )}
            <p className="flex items-center gap-sm text-xs text-muted-foreground">
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
          <div className="h-px bg-border" />
          <PasswordSection />
        </Section>
      </div>
    </PageContainer>
  );
}
