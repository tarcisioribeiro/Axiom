/* eslint-disable max-lines */
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Wallet,
  Shield,
  Library,
  Calendar,
  LayoutDashboard,
  CreditCard,
  Receipt,
  TrendingDown,
  TrendingUp,
  CalendarClock,
  ArrowLeftRight,
  HandCoins,
  Users,
  Key,
  Archive,
  BookOpen,
  UserPen,
  Building2,
  FileText,
  BookMarked,
  CheckCircle2,
  Target,
  Vault,
  FolderOpen,
  ClipboardList,
  ShoppingCart,
  Tag,
  BarChart3,
  FileInput,
  Dumbbell,
  UtensilsCrossed,
  GraduationCap,
  Brain,
  Network,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
}

interface RouteConfig {
  labelKey: string;
  icon: LucideIcon;
  moduleKey?: string;
  moduleIcon?: LucideIcon;
  subModuleKey?: string;
  subModuleIcon?: LucideIcon;
}

const routeConfigs: Record<string, RouteConfig> = {
  '/': { labelKey: 'breadcrumb.home', icon: Home },

  // Personal Planning Module
  '/planning/dashboard': {
    labelKey: 'breadcrumb.dashboard',
    icon: LayoutDashboard,
    moduleKey: 'breadcrumb.planning',
    moduleIcon: Calendar,
  },
  '/planning/daily': {
    labelKey: 'breadcrumb.dailyChecklist',
    icon: CheckCircle2,
    moduleKey: 'breadcrumb.planning',
    moduleIcon: Calendar,
  },
  '/planning/routine-tasks': {
    labelKey: 'breadcrumb.routineTasks',
    icon: Calendar,
    moduleKey: 'breadcrumb.planning',
    moduleIcon: Calendar,
  },
  '/planning/today-tasks': {
    labelKey: 'breadcrumb.todayTasks',
    icon: CheckCircle2,
    moduleKey: 'breadcrumb.planning',
    moduleIcon: Calendar,
  },
  '/planning/goals': {
    labelKey: 'breadcrumb.goals',
    icon: Target,
    moduleKey: 'breadcrumb.planning',
    moduleIcon: Calendar,
  },
  '/planning/workout': {
    labelKey: 'breadcrumb.workout',
    icon: Dumbbell,
    moduleKey: 'breadcrumb.planning',
    moduleIcon: Calendar,
  },
  '/planning/nutrition': {
    labelKey: 'breadcrumb.nutrition',
    icon: UtensilsCrossed,
    moduleKey: 'breadcrumb.planning',
    moduleIcon: Calendar,
  },

  // Financial Control Module
  '/dashboard': {
    labelKey: 'breadcrumb.dashboard',
    icon: LayoutDashboard,
    moduleKey: 'breadcrumb.finance',
    moduleIcon: Wallet,
  },
  '/accounts': {
    labelKey: 'breadcrumb.accounts',
    icon: Wallet,
    moduleKey: 'breadcrumb.finance',
    moduleIcon: Wallet,
    subModuleKey: 'breadcrumb.registrations',
    subModuleIcon: FolderOpen,
  },
  '/credit-cards': {
    labelKey: 'breadcrumb.creditCards',
    icon: CreditCard,
    moduleKey: 'breadcrumb.finance',
    moduleIcon: Wallet,
    subModuleKey: 'breadcrumb.registrations',
    subModuleIcon: FolderOpen,
  },
  '/credit-card-bills': {
    labelKey: 'breadcrumb.creditCardBills',
    icon: Receipt,
    moduleKey: 'breadcrumb.finance',
    moduleIcon: Wallet,
    subModuleKey: 'breadcrumb.registrations',
    subModuleIcon: FolderOpen,
  },
  '/fixed-expenses': {
    labelKey: 'breadcrumb.fixedExpenses',
    icon: CalendarClock,
    moduleKey: 'breadcrumb.finance',
    moduleIcon: Wallet,
    subModuleKey: 'breadcrumb.registrations',
    subModuleIcon: FolderOpen,
  },
  '/categorization-rules': {
    labelKey: 'breadcrumb.categorizationRules',
    icon: Tag,
    moduleKey: 'breadcrumb.finance',
    moduleIcon: Wallet,
    subModuleKey: 'breadcrumb.registrations',
    subModuleIcon: FolderOpen,
  },
  '/payables': {
    labelKey: 'breadcrumb.payables',
    icon: Receipt,
    moduleKey: 'breadcrumb.finance',
    moduleIcon: Wallet,
    subModuleKey: 'breadcrumb.registrations',
    subModuleIcon: FolderOpen,
  },
  '/financial-goals': {
    labelKey: 'breadcrumb.financialGoals',
    icon: Target,
    moduleKey: 'breadcrumb.finance',
    moduleIcon: Wallet,
    subModuleKey: 'breadcrumb.registrations',
    subModuleIcon: FolderOpen,
  },
  '/members': {
    labelKey: 'breadcrumb.members',
    icon: Users,
    moduleKey: 'breadcrumb.finance',
    moduleIcon: Wallet,
    subModuleKey: 'breadcrumb.registrations',
    subModuleIcon: FolderOpen,
  },
  '/expenses': {
    labelKey: 'breadcrumb.expenses',
    icon: TrendingDown,
    moduleKey: 'breadcrumb.finance',
    moduleIcon: Wallet,
    subModuleKey: 'breadcrumb.records',
    subModuleIcon: ClipboardList,
  },
  '/revenues': {
    labelKey: 'breadcrumb.revenues',
    icon: TrendingUp,
    moduleKey: 'breadcrumb.finance',
    moduleIcon: Wallet,
    subModuleKey: 'breadcrumb.records',
    subModuleIcon: ClipboardList,
  },
  '/credit-card-expenses': {
    labelKey: 'breadcrumb.creditCardExpenses',
    icon: ShoppingCart,
    moduleKey: 'breadcrumb.finance',
    moduleIcon: Wallet,
    subModuleKey: 'breadcrumb.records',
    subModuleIcon: ClipboardList,
  },
  '/transfers': {
    labelKey: 'breadcrumb.transfers',
    icon: ArrowLeftRight,
    moduleKey: 'breadcrumb.finance',
    moduleIcon: Wallet,
    subModuleKey: 'breadcrumb.records',
    subModuleIcon: ClipboardList,
  },
  '/loans': {
    labelKey: 'breadcrumb.loans',
    icon: HandCoins,
    moduleKey: 'breadcrumb.finance',
    moduleIcon: Wallet,
    subModuleKey: 'breadcrumb.records',
    subModuleIcon: ClipboardList,
  },
  '/vaults': {
    labelKey: 'breadcrumb.vaults',
    icon: Vault,
    moduleKey: 'breadcrumb.finance',
    moduleIcon: Wallet,
    subModuleKey: 'breadcrumb.records',
    subModuleIcon: ClipboardList,
  },

  // Security Module
  '/security/dashboard': {
    labelKey: 'breadcrumb.dashboard',
    icon: LayoutDashboard,
    moduleKey: 'breadcrumb.security',
    moduleIcon: Shield,
  },
  '/security/passwords': {
    labelKey: 'breadcrumb.passwords',
    icon: Key,
    moduleKey: 'breadcrumb.security',
    moduleIcon: Shield,
  },
  '/security/stored-cards': {
    labelKey: 'breadcrumb.storedCards',
    icon: CreditCard,
    moduleKey: 'breadcrumb.security',
    moduleIcon: Shield,
  },
  '/security/stored-accounts': {
    labelKey: 'breadcrumb.storedAccounts',
    icon: Wallet,
    moduleKey: 'breadcrumb.security',
    moduleIcon: Shield,
  },
  '/security/archives': {
    labelKey: 'breadcrumb.archives',
    icon: Archive,
    moduleKey: 'breadcrumb.security',
    moduleIcon: Shield,
  },
  '/security/import': {
    labelKey: 'breadcrumb.passwordImport',
    icon: FileInput,
    moduleKey: 'breadcrumb.security',
    moduleIcon: Shield,
  },

  // Library Module
  '/library/dashboard': {
    labelKey: 'breadcrumb.dashboard',
    icon: LayoutDashboard,
    moduleKey: 'breadcrumb.library',
    moduleIcon: Library,
  },
  '/library/books': {
    labelKey: 'breadcrumb.books',
    icon: BookOpen,
    moduleKey: 'breadcrumb.library',
    moduleIcon: Library,
  },
  '/library/authors': {
    labelKey: 'breadcrumb.authors',
    icon: UserPen,
    moduleKey: 'breadcrumb.library',
    moduleIcon: Library,
  },
  '/library/publishers': {
    labelKey: 'breadcrumb.publishers',
    icon: Building2,
    moduleKey: 'breadcrumb.library',
    moduleIcon: Library,
  },
  '/library/summaries': {
    labelKey: 'breadcrumb.summaries',
    icon: FileText,
    moduleKey: 'breadcrumb.library',
    moduleIcon: Library,
  },
  '/library/readings': {
    labelKey: 'breadcrumb.readings',
    icon: BookMarked,
    moduleKey: 'breadcrumb.library',
    moduleIcon: Library,
  },
  '/library/courses': {
    labelKey: 'breadcrumb.courses',
    icon: GraduationCap,
    moduleKey: 'breadcrumb.library',
    moduleIcon: Library,
  },
  '/library/skills': {
    labelKey: 'breadcrumb.skills',
    icon: Brain,
    moduleKey: 'breadcrumb.library',
    moduleIcon: Library,
  },
  '/library/knowledge-graph': {
    labelKey: 'breadcrumb.knowledgeGraph',
    icon: Network,
    moduleKey: 'breadcrumb.library',
    moduleIcon: Library,
  },
};

interface RoutePattern {
  pattern: RegExp;
  config: RouteConfig;
}

const routePatterns: RoutePattern[] = [
  {
    pattern: /^\/members\/\d+\/report$/,
    config: {
      labelKey: 'breadcrumb.memberFinancialReport',
      icon: BarChart3,
      moduleKey: 'breadcrumb.finance',
      moduleIcon: Wallet,
      subModuleKey: 'breadcrumb.members',
      subModuleIcon: Users,
    },
  },
];

/**
 * Hook para gerar breadcrumbs de navegação baseado na rota atual.
 * Suporta i18n — recalcula automaticamente quando o idioma muda.
 */
export function useBreadcrumb() {
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    const pathname = location.pathname;
    const config =
      routeConfigs[pathname] ??
      routePatterns.find((p) => p.pattern.test(pathname))?.config;

    if (!config) {
      return [{ label: t('breadcrumb.home'), href: '/', icon: Home }];
    }

    const items: BreadcrumbItem[] = [
      { label: t('breadcrumb.home'), href: '/', icon: Home },
    ];

    // Adiciona módulo se existir
    if (config.moduleKey) {
      items.push({
        label: t(config.moduleKey),
        icon: config.moduleIcon,
      });
    }

    // Adiciona submódulo se existir
    if (config.subModuleKey) {
      items.push({
        label: t(config.subModuleKey),
        icon: config.subModuleIcon,
      });
    }

    // Adiciona página atual (sem link)
    if (pathname !== '/') {
      items.push({
        label: t(config.labelKey),
        icon: config.icon,
      });
    }

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, i18n.language, t]);

  const currentPage = useMemo(() => {
    const pathname = location.pathname;
    const config =
      routeConfigs[pathname] ??
      routePatterns.find((p) => p.pattern.test(pathname))?.config;
    return config ? t(config.labelKey) : t('breadcrumb.home');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, i18n.language, t]);

  return { breadcrumbs, currentPage };
}
