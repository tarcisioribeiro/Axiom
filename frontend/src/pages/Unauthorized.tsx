import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export default function Unauthorized() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-md text-6xl font-bold text-destructive">
          {t('pages.unauthorized.code')}
        </h1>
        <h2 className="mb-sm text-2xl font-semibold">
          {t('pages.unauthorized.title')}
        </h2>
        <p className="mb-lg">{t('pages.unauthorized.message')}</p>
        <Button asChild>
          <Link to="/">{t('pages.unauthorized.backBtn')}</Link>
        </Button>
      </div>
    </div>
  );
}
