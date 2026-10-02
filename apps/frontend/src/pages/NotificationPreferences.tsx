import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { NotificationPreferencesContent } from '@/components/notifications/NotificationPreferencesContent';

export default function NotificationPreferences() {
  const { t } = useTranslation();

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.notificationPreferences.title')}
        icon={<Bell className="h-6 w-6" />}
      />
      <div className="space-y-lg">
        <NotificationPreferencesContent />
      </div>
    </PageContainer>
  );
}
