import { useQuery } from '@tanstack/react-query';
import { Bell, Pencil, Shield, SlidersHorizontal, UserPen } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { NotificationPreferencesContent } from '@/components/notifications/NotificationPreferencesContent';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AppPreferencesDialog } from '@/components/user-profile/AppPreferencesDialog';
import { EmailVerificationSection } from '@/components/user-profile/EmailVerificationSection';
import { PasswordRow } from '@/components/user-profile/PasswordSection';
import { PersonalDataSection } from '@/components/user-profile/PersonalDataSection';
import { ProfileAvatar } from '@/components/user-profile/ProfileAvatar';
import { Section } from '@/components/user-profile/Section';
import { TwoFactorRow } from '@/components/user-profile/TwoFactorRow';
import { membersService } from '@/services/members-service';
import { useAuthStore } from '@/stores/auth-store';

export default function UserProfile() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const { data: member } = useQuery({
    queryKey: ['members', 'me'],
    queryFn: () => membersService.getCurrentUserMember(),
  });

  const fullName = member?.name ?? user?.first_name ?? '';
  const emailVerified = member?.email_verified ?? false;

  return (
    <PageContainer>
      <PageHeader title={t('breadcrumb.profile')} icon={<UserPen />} />
      <Card className="divide-border/60 grid overflow-hidden max-lg:divide-y lg:grid-cols-[minmax(0,1fr)_28rem] lg:divide-x">
        <div className="divide-border/60 divide-y">
          <header className="gap-md p-lg sm:p-xl flex items-center">
            <ProfileAvatar name={fullName} photoUrl={member?.profile_photo} />
            <h2 className="text-2xl font-bold tracking-tight">{fullName || '—'}</h2>
          </header>
          {member && <PersonalDataSection memberId={member.id} />}
        </div>

        <div className="divide-border/60 divide-y">
          <EmailVerificationSection emailVerified={emailVerified} />

          <Section
            icon={<SlidersHorizontal className="h-4 w-4" />}
            title={t('userProfile.preferences.title')}
          >
            {/* Preferências de notificação e do app: uma linha cada, mesmo botão */}
            {[
              {
                icon: Bell,
                label: t('nav.notificationPreferences'),
                open: () => setNotificationsOpen(true),
              },
              {
                icon: SlidersHorizontal,
                label: t('userProfile.appPreferences.title'),
                open: () => setPreferencesOpen(true),
              },
            ].map((row) => (
              <div key={row.label} className="gap-md flex items-center justify-between">
                <p className="gap-xs text-muted-foreground flex items-center text-sm">
                  <row.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {row.label}
                </p>
                <Button variant="outline" size="sm" onClick={row.open}>
                  <Pencil />
                  {t('common.actions.edit')}
                </Button>
              </div>
            ))}
          </Section>

          <Section
            icon={<Shield className="h-4 w-4" />}
            title={t('userProfile.security.title')}
          >
            <TwoFactorRow />
            <PasswordRow strength={member?.password_strength} />
          </Section>
        </div>
      </Card>

      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle className="gap-sm flex items-center">
              <Bell className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
              {t('pages.notificationPreferences.title')}
            </DialogTitle>
          </DialogHeader>
          <NotificationPreferencesContent onClose={() => setNotificationsOpen(false)} />
        </DialogContent>
      </Dialog>

      <AppPreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
    </PageContainer>
  );
}
