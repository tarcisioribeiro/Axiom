import { Brain, MessageSquare } from 'lucide-react';

// ─── Rosenberg ────────────────────────────────────────────────────────────────

export const ROSENBERG_QUESTION_KEYS = [
  'q1',
  'q2',
  'q3',
  'q4',
  'q5',
  'q6',
  'q7',
  'q8',
  'q9',
  'q10',
] as const;

export const ROSENBERG_OPTION_KEYS = [
  { value: 0, labelKey: 'stronglyDisagree' },
  { value: 1, labelKey: 'disagree' },
  { value: 2, labelKey: 'agree' },
  { value: 3, labelKey: 'stronglyAgree' },
] as const;

export const CHECKIN_SCALES = [
  { key: 'loneliness', colorHigh: false },
  { key: 'neediness', colorHigh: false },
  { key: 'anxiety', colorHigh: false },
  { key: 'sadness', colorHigh: false },
  { key: 'motivation', colorHigh: true },
  { key: 'energy', colorHigh: true },
] as const;

export const CHECKIN_TEXTS = [
  { key: 'what_happened', icon: MessageSquare },
  { key: 'occupying_thoughts', icon: Brain },
] as const;
