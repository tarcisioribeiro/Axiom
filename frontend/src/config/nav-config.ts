/* eslint-disable max-lines */
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Wallet,
  Shield,
  Lightbulb,
  CreditCard,
  TrendingDown,
  CalendarClock,
  ArrowLeftRight,
  HandCoins,
  Archive,
  Key,
  UserPen,
  Building2,
  Home,
  Calendar,
  Target,
  CheckCircle2,
  Users,
  FolderOpen,
  ClipboardList,
  Vault,
  PiggyBank,
  Receipt,
  Tag,
  BotMessageSquare,
  Dumbbell,
  UtensilsCrossed,
  GraduationCap,
  Brain,
  Network,
  Library,
  BookMarked,
  Scale,
  CalendarDays,
  TrendingUp,
  RefreshCcw,
  NotebookPen,
  ListTodo,
  HeartPulse,
} from 'lucide-react';

export interface NavSubItem {
  titleKey: string;
  href: string;
  icon: LucideIcon;
  permission?: { appName: string; action: string };
}

export interface NavSubModule {
  id: string;
  titleKey: string;
  icon: LucideIcon;
  items: NavSubItem[];
}

export interface NavModule {
  id: string;
  titleKey: string;
  icon: LucideIcon;
  items?: NavSubItem[];
  subModules?: NavSubModule[];
  topItems?: NavSubItem[];
}

export interface NavItem {
  titleKey: string;
  href: string;
  icon: LucideIcon;
  permission?: { appName: string; action: string };
}

export const navItems: NavItem[] = [
  { titleKey: 'nav.home', href: '/', icon: Home },
  { titleKey: 'nav.agents', href: '/agents', icon: BotMessageSquare },
];

export const navModules: NavModule[] = [
  {
    id: 'planning',
    titleKey: 'nav.modules.planning',
    icon: Calendar,
    topItems: [
      { titleKey: 'nav.dashboard', href: '/planning/dashboard', icon: LayoutDashboard },
    ],
    subModules: [
      {
        id: 'planning-daily',
        titleKey: 'nav.submodules.daily',
        icon: ListTodo,
        items: [
          {
            titleKey: 'nav.items.dailyChecklist',
            href: '/planning/daily-checklist',
            icon: CheckCircle2,
          },
          {
            titleKey: 'nav.items.tasksGoals',
            href: '/planning/tasks-goals',
            icon: Target,
          },
          {
            titleKey: 'nav.items.reflections',
            href: '/planning/reflections',
            icon: NotebookPen,
          },
        ],
      },
      {
        id: 'planning-health',
        titleKey: 'nav.submodules.health',
        icon: HeartPulse,
        items: [
          { titleKey: 'nav.items.workout', href: '/planning/workout', icon: Dumbbell },
          {
            titleKey: 'nav.items.nutrition',
            href: '/planning/nutrition',
            icon: UtensilsCrossed,
          },
        ],
      },
    ],
  },
  {
    id: 'finance',
    titleKey: 'nav.modules.finance',
    icon: Wallet,
    topItems: [
      { titleKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
    subModules: [
      {
        id: 'finance-registrations',
        titleKey: 'nav.submodules.registrations',
        icon: FolderOpen,
        items: [
          { titleKey: 'nav.items.accounts', href: '/accounts', icon: Wallet },
          {
            titleKey: 'nav.items.creditCards',
            href: '/credit-cards',
            icon: CreditCard,
          },
          { titleKey: 'nav.items.members', href: '/members', icon: Users },
          { titleKey: 'nav.items.budgets', href: '/budgets', icon: PiggyBank },
          {
            titleKey: 'nav.items.financialGoals',
            href: '/financial-goals',
            icon: Target,
          },
          {
            titleKey: 'nav.items.recurring',
            href: '/recurring',
            icon: CalendarClock,
          },
          {
            titleKey: 'nav.items.categorizationRules',
            href: '/categorization-rules',
            icon: Tag,
          },
          {
            titleKey: 'nav.items.tags',
            href: '/tags',
            icon: Tag,
          },
        ],
      },
      {
        id: 'finance-records',
        titleKey: 'nav.submodules.records',
        icon: ClipboardList,
        items: [
          {
            titleKey: 'nav.items.transactions',
            href: '/transactions',
            icon: TrendingDown,
          },
          { titleKey: 'nav.items.transfers', href: '/transfers', icon: ArrowLeftRight },
          {
            titleKey: 'nav.items.bills',
            href: '/bills',
            icon: Receipt,
          },
          { titleKey: 'nav.items.vaults', href: '/vaults', icon: Vault },
          { titleKey: 'nav.items.loans', href: '/loans', icon: HandCoins },
          {
            titleKey: 'nav.items.bankReconciliation',
            href: '/bank-reconciliation',
            icon: Scale,
          },
          {
            titleKey: 'nav.items.financialCalendar',
            href: '/finance/calendar',
            icon: CalendarDays,
          },
          {
            titleKey: 'nav.items.netWorth',
            href: '/finance/net-worth',
            icon: TrendingUp,
          },
          {
            titleKey: 'nav.items.subscriptions',
            href: '/finance/subscriptions',
            icon: RefreshCcw,
          },
        ],
      },
    ],
  },
  {
    id: 'security',
    titleKey: 'nav.modules.security',
    icon: Shield,
    items: [
      { titleKey: 'nav.dashboard', href: '/security/dashboard', icon: LayoutDashboard },
      { titleKey: 'nav.items.passwords', href: '/security/passwords', icon: Key },
      {
        titleKey: 'nav.items.storedCards',
        href: '/security/stored-cards',
        icon: CreditCard,
      },
      {
        titleKey: 'nav.items.storedAccounts',
        href: '/security/stored-accounts',
        icon: Wallet,
      },
      { titleKey: 'nav.items.archives', href: '/security/archives', icon: Archive },
    ],
  },
  {
    id: 'library',
    titleKey: 'nav.modules.library',
    icon: Brain,
    topItems: [
      { titleKey: 'nav.dashboard', href: '/library/dashboard', icon: LayoutDashboard },
    ],
    subModules: [
      {
        id: 'library-books',
        titleKey: 'nav.submodules.books',
        icon: BookMarked,
        items: [
          { titleKey: 'nav.items.books', href: '/library/books', icon: Library },
          { titleKey: 'nav.items.authors', href: '/library/authors', icon: UserPen },
          {
            titleKey: 'nav.items.publishers',
            href: '/library/publishers',
            icon: Building2,
          },
        ],
      },
      {
        id: 'library-intellect',
        titleKey: 'nav.submodules.intellect',
        icon: Lightbulb,
        items: [
          {
            titleKey: 'nav.items.courses',
            href: '/library/courses',
            icon: GraduationCap,
          },
          {
            titleKey: 'nav.items.skills',
            href: '/library/skills',
            icon: Brain,
          },
          {
            titleKey: 'nav.items.knowledgeGraph',
            href: '/library/knowledge-graph',
            icon: Network,
          },
        ],
      },
    ],
  },
];

/** Returns all leaf NavSubItems within a module (topItems + items + all subModule items). */
export const getAllModuleItems = (module: NavModule): NavSubItem[] => {
  const items: NavSubItem[] = [];
  if (module.topItems) items.push(...module.topItems);
  if (module.items) items.push(...module.items);
  if (module.subModules) {
    module.subModules.forEach((sub) => items.push(...sub.items));
  }
  return items;
};

export const isPathActive = (href: string, pathname: string): boolean => {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
};
