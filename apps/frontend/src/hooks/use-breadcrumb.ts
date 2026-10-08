/* eslint-disable max-lines */
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Brain,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  CreditCard,
  FileUp,
  GitCompareArrows,
  Home,
  Landmark,
  LayoutList,
  Receipt,
  ScrollText,
  Shield,
  ShieldCheck,
  Tag,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserPen,
  Webhook,
  Zap,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

import {
  navItems,
  navModules,
  type NavModule,
  type NavSubItem,
  type NavSubModule,
} from '@/config/nav-config';
import { useBreadcrumbExtraStore } from '@/stores/breadcrumb-extra-store';
import type { IconComponent } from '@/types/icon';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: IconComponent;
}

interface ResolvedRoute {
  labelKey: string;
  icon: IconComponent;
  moduleTitleKey?: string;
  moduleIcon?: IconComponent;
  moduleHref?: string;
  subModuleTitleKey?: string;
  subModuleIcon?: IconComponent;
}

/**
 * Índice rota -> breadcrumb construído a partir do `nav-config` (a mesma
 * fonte que alimenta a Sidebar), em vez de um dicionário mantido à mão: assim
 * o breadcrumb nunca fica defasado quando uma rota é adicionada/renomeada —
 * basta estar no nav-config para aparecer aqui também.
 */
function buildRouteIndex(): Record<string, ResolvedRoute> {
  const index: Record<string, ResolvedRoute> = {};

  for (const item of navItems) {
    index[item.href] = { labelKey: item.titleKey, icon: item.icon };
  }

  for (const module of navModules) {
    const moduleHref = module.topItems?.[0]?.href ?? module.items?.[0]?.href;
    const addItem = (item: NavSubItem, subModule?: NavSubModule) => {
      index[item.href] = {
        labelKey: item.titleKey,
        icon: item.icon,
        moduleTitleKey: module.titleKey,
        moduleIcon: module.icon,
        moduleHref,
        subModuleTitleKey: subModule?.titleKey,
        subModuleIcon: subModule?.icon,
      };
    };
    module.topItems?.forEach((item) => addItem(item));
    module.items?.forEach((item) => addItem(item));
    module.subModules?.forEach((sub) =>
      sub.items.forEach((item) => addItem(item, sub))
    );
  }

  return index;
}

const routeIndex = buildRouteIndex();
const moduleIndex: Record<string, NavModule> = Object.fromEntries(
  navModules.map((m) => [m.id, m])
);

/** Páginas secundárias (menu do usuário, drill-down) que não estão na Sidebar
 * e por isso não entram no `nav-config` — mantidas à parte, reaproveitando o
 * título já usado pela própria página. */
interface ExtraRoute {
  labelKey: string;
  icon: IconComponent;
  moduleId?: string;
}

const extraRoutes: Record<string, ExtraRoute> = {
  '/webhooks': { labelKey: 'webhooks.title', icon: Webhook, moduleId: 'finance' },
  '/vaults/simulator': {
    labelKey: 'pages.vaultSimulator.title',
    icon: TrendingUp,
    moduleId: 'finance',
  },
  '/security/activity-logs': {
    labelKey: 'pages.activityLogs.title',
    icon: ScrollText,
    moduleId: 'security',
  },
  '/security/password-import': {
    labelKey: 'pages.passwordImport.title',
    icon: FileUp,
    moduleId: 'security',
  },
  '/security/health': {
    labelKey: 'pages.vaultHealth.title',
    icon: ShieldCheck,
    moduleId: 'security',
  },
  '/library/intellect-today': {
    labelKey: 'pages.intellectToday.title',
    icon: Brain,
    moduleId: 'library',
  },
  '/library/flashcards': {
    labelKey: 'pages.flashcards.title',
    icon: Brain,
    moduleId: 'library',
  },
  '/settings/profile': { labelKey: 'breadcrumb.profile', icon: UserPen },
  '/settings/permissions': { labelKey: 'pages.permissions.title', icon: Shield },
  '/settings/notifications': {
    labelKey: 'pages.notificationPreferences.title',
    icon: Bell,
  },
  '/settings/two-factor': { labelKey: 'pages.twoFactor.title', icon: Shield },
  // Detalhe de conciliação (/bank-reconciliation/:importId) — casada por
  // prefixo abaixo, já que o id na URL impede um match exato.
  '/bank-reconciliation': {
    labelKey: 'breadcrumb.bankReconciliation',
    icon: ArrowLeftRight,
    moduleId: 'finance',
  },
};

function resolveExtraRoute(pathname: string): ExtraRoute | undefined {
  return (
    extraRoutes[pathname] ??
    (pathname.startsWith('/bank-reconciliation/')
      ? extraRoutes['/bank-reconciliation']
      : undefined)
  );
}

/** Rótulo/ícone de cada aba, por rota "pai" (ex.: `/transactions`) — usado
 * quando a URL aponta para uma aba específica (`/transactions/expenses`),
 * já que essas sub-rotas não existem como item próprio no nav-config. */
interface TabConfig {
  labelKey: string;
  icon: IconComponent;
}

const tabbedRoutes: Record<string, Record<string, TabConfig>> = {
  '/transactions': {
    expenses: { labelKey: 'pages.expenses.title', icon: TrendingDown },
    revenues: { labelKey: 'pages.revenues.title', icon: TrendingUp },
    'credit-card-expenses': {
      labelKey: 'nav.items.creditCardExpenses',
      icon: CreditCard,
    },
  },
  '/recurring': {
    'fixed-expenses': { labelKey: 'pages.fixedExpenses.title', icon: CalendarClock },
    'fixed-revenues': { labelKey: 'pages.fixedRevenues.title', icon: Calendar },
  },
  '/finance/rules-tags': {
    'automation-rules': { labelKey: 'nav.items.automationRules', icon: Zap },
    tags: { labelKey: 'nav.items.tags', icon: Tag },
  },
  '/bills': {
    payables: { labelKey: 'pages.payables.title', icon: Receipt },
    receivables: { labelKey: 'pages.receivables.title', icon: TrendingUp },
  },
  '/finance/agenda': {
    calendar: { labelKey: 'nav.items.financialCalendar', icon: CalendarDays },
    'monthly-planner': { labelKey: 'nav.items.monthlyPlanner', icon: CalendarCheck },
  },
  '/finance/analytics': {
    'spending-insights': { labelKey: 'nav.items.spendingInsights', icon: BarChart3 },
    'month-comparison': {
      labelKey: 'nav.items.monthComparison',
      icon: GitCompareArrows,
    },
  },
  '/finance/financial-health': {
    'net-worth': { labelKey: 'nav.items.netWorth', icon: TrendingUp },
    'debt-payoff': { labelKey: 'nav.items.debtPayoff', icon: Landmark },
  },
  '/credit-cards': {
    cards: { labelKey: 'pages.creditCards.title', icon: CreditCard },
    bills: { labelKey: 'pages.creditCardBills.title', icon: Receipt },
  },
  '/planning/tasks-goals': {
    daily: { labelKey: 'pages.dailyChecklist.title', icon: CheckCircle2 },
    routine: { labelKey: 'pages.routineTasks.title', icon: Calendar },
    goals: { labelKey: 'pages.goals.title', icon: Trophy },
  },
};

/** Sub-abas de segundo nível (ex.: `/planning/tasks-goals/routine/tasks`). */
const nestedTabbedRoutes: Record<string, Record<string, TabConfig>> = {
  '/planning/tasks-goals/routine': {
    tasks: { labelKey: 'pages.routineTasks.tasksTab', icon: CheckSquare },
    'focus-blocks': {
      labelKey: 'pages.routineTasks.focusBlocks.title',
      icon: LayoutList,
    },
  },
};

interface MatchedTabbedRoute {
  parentHref: string;
  tabSlug: string;
  tab: TabConfig;
  sub?: TabConfig;
}

function matchTabbedRoute(pathname: string): MatchedTabbedRoute | undefined {
  for (const parentHref of Object.keys(tabbedRoutes)) {
    if (!pathname.startsWith(`${parentHref}/`)) continue;
    const [tabSlug, subSlug] = pathname.slice(parentHref.length + 1).split('/');
    const tab = tabbedRoutes[parentHref][tabSlug];
    if (!tab) continue;
    const sub = subSlug
      ? nestedTabbedRoutes[`${parentHref}/${tabSlug}`]?.[subSlug]
      : undefined;
    return { parentHref, tabSlug, tab, sub };
  }
  return undefined;
}

/**
 * Hook para gerar breadcrumbs de navegação baseado na rota atual.
 * Suporta i18n — recalcula automaticamente quando o idioma muda.
 */
export function useBreadcrumb() {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const extraLabel = useBreadcrumbExtraStore((s) => s.extraLabel);
  const extraSubLabel = useBreadcrumbExtraStore((s) => s.extraSubLabel);

  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    const pathname = location.pathname;
    const items: BreadcrumbItem[] = [
      { label: t('breadcrumb.home'), href: '/', icon: Home },
    ];

    const resolved = routeIndex[pathname];
    const tabbed = resolved ? undefined : matchTabbedRoute(pathname);
    const extra = resolved || tabbed ? undefined : resolveExtraRoute(pathname);

    if (resolved) {
      if (resolved.moduleTitleKey) {
        items.push({
          label: t(resolved.moduleTitleKey),
          icon: resolved.moduleIcon,
          href: resolved.moduleHref,
        });
      }
      if (resolved.subModuleTitleKey) {
        items.push({
          label: t(resolved.subModuleTitleKey),
          icon: resolved.subModuleIcon,
          href: resolved.moduleHref,
        });
      }
      if (pathname !== '/') {
        items.push({ label: t(resolved.labelKey), icon: resolved.icon });
      }
    } else if (tabbed) {
      const base = routeIndex[tabbed.parentHref];
      if (base?.moduleTitleKey) {
        items.push({
          label: t(base.moduleTitleKey),
          icon: base.moduleIcon,
          href: base.moduleHref,
        });
      }
      if (base?.subModuleTitleKey) {
        items.push({
          label: t(base.subModuleTitleKey),
          icon: base.subModuleIcon,
          href: base.moduleHref,
        });
      }
      items.push({
        label: t(tabbed.tab.labelKey),
        icon: tabbed.tab.icon,
        href: tabbed.sub ? `${tabbed.parentHref}/${tabbed.tabSlug}` : undefined,
      });
      if (tabbed.sub) {
        items.push({ label: t(tabbed.sub.labelKey), icon: tabbed.sub.icon });
      }
    } else if (extra) {
      const module = extra.moduleId ? moduleIndex[extra.moduleId] : undefined;
      if (module) {
        items.push({
          label: t(module.titleKey),
          icon: module.icon,
          href: module.topItems?.[0]?.href ?? module.items?.[0]?.href,
        });
      }
      items.push({ label: t(extra.labelKey), icon: extra.icon });
    }

    // Label extra dinâmico (ex.: aba ativa de uma página com tabs)
    if (extraLabel) {
      items.push({ label: extraLabel });
    }

    // Sub-label extra (ex.: nome do item selecionado dentro da aba)
    if (extraSubLabel) {
      items.push({ label: extraSubLabel });
    }

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, i18n.language, t, extraLabel, extraSubLabel]);

  return { breadcrumbs };
}
