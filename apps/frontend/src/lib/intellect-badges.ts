import type { TFunction } from 'i18next';

import type { IntellectBadge } from '@/services/intellect-badges-service';

/** Medalhas (§9): tokens `--medal-*`, iguais em todo o app. */
export const MEDAL_CLASSES: Record<string, string> = {
  bronze: 'bg-medal-bronze/15 text-medal-bronze border-medal-bronze/40',
  silver: 'bg-medal-silver/15 text-medal-silver border-medal-silver/40',
  gold: 'bg-medal-gold/15 text-medal-gold border-medal-gold/40',
};

/** Nome da conquista traduzido a partir do código (o backend manda o rótulo em pt-BR). */
export const badgeLabel = (t: TFunction, badge: IntellectBadge): string =>
  t(`pages.intellectBadges.codes.${badge.code}`, { defaultValue: badge.code_display });
