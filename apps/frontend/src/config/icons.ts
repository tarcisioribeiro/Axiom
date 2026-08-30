/* eslint-disable max-lines */
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Ban,
  Banknote,
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  Car,
  CheckCircle,
  Clock,
  CloudSun,
  CreditCard,
  Dog,
  Droplets,
  Dumbbell,
  FileText,
  Film,
  Flame,
  Frown,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  HandCoins,
  Heart,
  HeartPulse,
  Home,
  Landmark,
  Languages,
  Laptop,
  Mail,
  Meh,
  Minus,
  Monitor,
  Moon,
  Package,
  Pencil,
  PiggyBank,
  Plane,
  Play,
  RefreshCw,
  Salad,
  Scale,
  Settings,
  Shield,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Smile,
  Sparkles,
  Stethoscope,
  Sun,
  Sunrise,
  Sunset,
  ThumbsDown,
  ThumbsUp,
  Ticket,
  TrendingDown,
  TrendingUp,
  Trophy,
  Tv,
  Undo2,
  User,
  Users,
  Utensils,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';

import type { IconComponent } from '@/types/icon';

export const EXPENSE_CATEGORY_ICONS: Record<string, IconComponent> = {
  'food and drink': Utensils,
  'bills and services': FileText,
  electronics: Smartphone,
  'family and friends': Users,
  pets: Dog,
  'digital signs': Tv,
  house: Home,
  purchases: ShoppingBag,
  donate: Gift,
  education: GraduationCap,
  loans: HandCoins,
  entertainment: Film,
  taxes: Landmark,
  investments: TrendingUp,
  others: Package,
  vestuary: Shirt,
  'health and care': HeartPulse,
  'professional services': Briefcase,
  supermarket: ShoppingCart,
  rates: Banknote,
  transport: Car,
  travels: Plane,
};

export const REVENUE_CATEGORY_ICONS: Record<string, IconComponent> = {
  deposit: Building2,
  award: Trophy,
  salary: Wallet,
  ticket: Ticket,
  income: BarChart3,
  refund: RefreshCw,
  cashback: CreditCard,
  transfer: ArrowRight,
  received_loan: HandCoins,
  loan_devolution: Undo2,
};

export const TASK_CATEGORY_ICONS: Record<string, IconComponent> = {
  health: Heart,
  intellect: Brain,
  spiritual: Sparkles,
  exercise: Dumbbell,
  nutrition: Salad,
  work: Briefcase,
  social: Users,
  finance: Wallet,
  household: Home,
  personal_care: Droplets,
  other: Package,
};

export const ACCOUNT_TYPE_ICONS: Record<string, IconComponent> = {
  CC: Building2,
  CS: Wallet,
  FG: ShieldCheck,
  VA: Utensils,
  VR: Salad,
  CP: PiggyBank,
};

export const STORED_ACCOUNT_TYPE_ICONS: Record<string, IconComponent> = {
  CC: CreditCard,
  CS: Wallet,
  CP: PiggyBank,
  CI: TrendingUp,
  OTHER: Building2,
};

export const INSTITUTION_ICONS: Record<string, IconComponent> = {
  NUB: CreditCard,
  SIC: Shield,
  MPG: ShoppingCart,
  IFB: Salad,
  CEF: Landmark,
  BB: Landmark,
  SAN: Building2,
  ITA: Building2,
  BRA: Building2,
  INT: CreditCard,
  C6B: CreditCard,
  PIC: Wallet,
};

export const BOOK_GENRE_ICONS: Record<string, IconComponent> = {
  Philosophy: Brain,
  History: Landmark,
  Psychology: Brain,
  Fiction: Sparkles,
  Policy: Scale,
  Technology: Smartphone,
  Theology: Sun,
};

export const BOOK_LITERARY_TYPE_ICONS: Record<string, IconComponent> = {
  book: BookOpen,
  collection: BookOpen,
  magazine: FileText,
  article: FileText,
  essay: Pencil,
};

export const BOOK_LANGUAGE_ICON: IconComponent = Languages;

export const READ_STATUS_ICONS: Record<string, IconComponent> = {
  to_read: BookOpen,
  reading: BookOpen,
  read: CheckCircle,
  paused: Clock,
};

export const TIME_OF_DAY_ICONS: Record<string, IconComponent> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon,
  dawn: Sunset,
};

export const PRIORITY_ICONS: Record<string, IconComponent> = {
  low: ArrowDown,
  medium: Minus,
  high: ArrowUp,
  critical: Flame,
};

export const PERIODICITY_ICONS: Record<string, IconComponent> = {
  daily: CalendarDays,
  weekdays: Calendar,
  weekly: Calendar,
  monthly: Calendar,
  custom: Settings,
};

export const GOAL_TYPE_ICONS: Record<string, IconComponent> = {
  consecutive_days: Flame,
  total_days: Calendar,
  avoid_habit: Ban,
  custom: Settings,
};

export const GOAL_STATUS_ICONS: Record<string, IconComponent> = {
  active: CheckCircle,
  completed: Trophy,
  failed: XCircle,
  cancelled: Ban,
};

export const FINANCIAL_GOAL_CATEGORY_ICONS: Record<string, IconComponent> = {
  savings: PiggyBank,
  investment: TrendingUp,
  emergency: Shield,
  travel: Plane,
  education: GraduationCap,
  property: Home,
  vehicle: Car,
  retirement: Clock,
  health: Heart,
  reduce_expenses: TrendingDown,
  increase_revenue: TrendingUp,
  other: Package,
};

export const MOOD_ICONS: Record<string, IconComponent> = {
  excellent: Smile,
  good: ThumbsUp,
  neutral: Meh,
  bad: Frown,
  terrible: ThumbsDown,
};

export const ARCHIVE_CATEGORY_ICONS: Record<string, IconComponent> = {
  personal: User,
  financial: Wallet,
  legal: Scale,
  medical: Stethoscope,
  tax: BarChart3,
  work: Briefcase,
  other: Package,
};

export const GREETING_ICONS: Record<string, IconComponent> = {
  morning: Sun,
  afternoon: CloudSun,
  evening: Moon,
};

export const PASSWORD_CATEGORY_ICONS: Record<string, IconComponent> = {
  social: Users,
  email: Mail,
  banking: Landmark,
  work: Briefcase,
  entertainment: Film,
  shopping: ShoppingBag,
  streaming: Tv,
  gaming: Gamepad2,
  other: Package,
};

export const PLATFORM_ICONS: Record<string, IconComponent> = {
  udemy: GraduationCap,
  coursera: BookOpen,
  youtube: Play,
  linkedin: Briefcase,
  alura: Laptop,
  pluralsight: Monitor,
  other: Globe,
};

export const TRANSFER_TYPE_ICONS: Record<string, IconComponent> = {
  pix: Zap,
  ted: Building2,
  doc: FileText,
  internal: ArrowLeftRight,
};

export const CARD_FLAG_ICON: IconComponent = CreditCard;
export const NATIONALITY_ICON: IconComponent = Globe;
export const COUNTRY_ICON: IconComponent = Globe;
