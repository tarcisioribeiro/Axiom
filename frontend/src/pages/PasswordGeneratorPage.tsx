import { Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PasswordGenerator } from '@/components/security/PasswordGenerator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function PasswordGeneratorPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader title={t('pages.passwordGenerator.title')} icon={<Wand2 />} />

      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{t('pages.passwordGenerator.subtitle')}</CardTitle>
            <CardDescription>{t('pages.passwordGenerator.desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordGenerator />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
