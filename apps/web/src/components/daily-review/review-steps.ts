import {
  Droplets,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Layers,
  Leaf,
  ListChecks,
  type LucideIcon,
  NotebookPen,
  Scale,
  Star,
  Target,
  Utensils,
} from 'lucide-react';

import type { ReviewItem, ReviewStepKey } from '@/types/daily-review';

export const STEP_ICONS: Record<ReviewStepKey, LucideIcon> = {
  reflection: NotebookPen,
  tasks: ListChecks,
  goals: Target,
  workout: Dumbbell,
  meals: Utensils,
  hydration: Droplets,
  checkin: HeartPulse,
  self_esteem: Star,
  self_esteem_periodic: Star,
  wellness: Leaf,
  weigh_in: Scale,
  study: GraduationCap,
  flashcards: Layers,
};

/** Etapas cujo registro abre um formulário (as demais são ação direta). */
export const DIALOG_STEPS: ReviewStepKey[] = [
  'reflection',
  'goals',
  'workout',
  'meals',
  'hydration',
  'checkin',
  'self_esteem',
  'self_esteem_periodic',
  'wellness',
  'weigh_in',
  'study',
];

export interface RegisterTarget {
  step: ReviewStepKey;
  item: ReviewItem;
  /** Dia em revisão (as etapas contínuas registram com a data de hoje). */
  date: string;
}
