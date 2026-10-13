import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

// Escala 1-5 do zxcvbn: cor da barra e cor da frase por nível.
const STRENGTH_LEVELS = [
  null,
  { key: 'veryWeak', bar: 'bg-destructive', text: 'text-destructive' },
  { key: 'weak', bar: 'bg-warning', text: 'text-warning' },
  { key: 'medium', bar: 'bg-info', text: 'text-info' },
  { key: 'strong', bar: 'bg-primary', text: 'text-primary' },
  { key: 'veryStrong', bar: 'bg-success', text: 'text-success' },
] as const;

export function PasswordStrength({ score }: { score: number }) {
  const { t } = useTranslation();
  const level = STRENGTH_LEVELS[score];
  if (!level) return null;

  return (
    <div className="gap-xs flex w-full flex-col items-center">
      <div className="gap-xs flex w-full">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              i <= score ? level.bar : 'bg-muted'
            )}
          />
        ))}
      </div>
      <p className={cn('text-center text-xs font-medium', level.text)}>
        {t(`userProfile.security.strength.${level.key}`)}
      </p>
    </div>
  );
}
