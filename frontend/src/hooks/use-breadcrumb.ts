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
  Bot,
  FolderOpen,
  ClipboardList,
  ShoppingCart,
} from 'lucide-react';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
}

interface RouteConfig {
  label: string;
  icon: LucideIcon;
  parent?: string;
  module?: string;
  subModule?: string;
}

const routeConfigs: Record<string, RouteConfig> = {
  '/': { label: 'Início', icon: Home },
  '/ai-assistant': { label: 'Assistente IA', icon: Bot },

  // Personal Planning Module
  '/planning/dashboard': {
    label: 'Dashboard',
    icon: LayoutDashboard,
    module: 'Planejamento Pessoal',
  },
  '/planning/daily': {
    label: 'Checklist Diário',
    icon: CheckCircle2,
    module: 'Planejamento Pessoal',
  },
  '/planning/routine-tasks': {
    label: 'Tarefas Rotineiras',
    icon: Calendar,
    module: 'Planejamento Pessoal',
  },
  '/planning/goals': {
    label: 'Objetivos',
    icon: Target,
    module: 'Planejamento Pessoal',
  },

  // Financial Control Module
  '/dashboard': {
    label: 'Dashboard',
    icon: LayoutDashboard,
    module: 'Controle Financeiro',
  },
  '/accounts': {
    label: 'Contas',
    icon: Wallet,
    module: 'Controle Financeiro',
    subModule: 'Cadastros',
  },
  '/credit-cards': {
    label: 'Cartões de Crédito',
    icon: CreditCard,
    module: 'Controle Financeiro',
    subModule: 'Cadastros',
  },
  '/credit-card-bills': {
    label: 'Faturas',
    icon: Receipt,
    module: 'Controle Financeiro',
    subModule: 'Cadastros',
  },
  '/fixed-expenses': {
    label: 'Gastos Fixos',
    icon: CalendarClock,
    module: 'Controle Financeiro',
    subModule: 'Cadastros',
  },
  '/payables': {
    label: 'Valores a Pagar',
    icon: Receipt,
    module: 'Controle Financeiro',
    subModule: 'Cadastros',
  },
  '/financial-goals': {
    label: 'Metas Financeiras',
    icon: Target,
    module: 'Controle Financeiro',
    subModule: 'Cadastros',
  },
  '/members': {
    label: 'Beneficiários/Credores',
    icon: Users,
    module: 'Controle Financeiro',
    subModule: 'Cadastros',
  },
  '/expenses': {
    label: 'Despesas',
    icon: TrendingDown,
    module: 'Controle Financeiro',
    subModule: 'Registros',
  },
  '/revenues': {
    label: 'Receitas',
    icon: TrendingUp,
    module: 'Controle Financeiro',
    subModule: 'Registros',
  },
  '/credit-card-expenses': {
    label: 'Gastos do Cartão',
    icon: ShoppingCart,
    module: 'Controle Financeiro',
    subModule: 'Registros',
  },
  '/transfers': {
    label: 'Transferências',
    icon: ArrowLeftRight,
    module: 'Controle Financeiro',
    subModule: 'Registros',
  },
  '/loans': {
    label: 'Empréstimos',
    icon: HandCoins,
    module: 'Controle Financeiro',
    subModule: 'Registros',
  },
  '/vaults': {
    label: 'Cofres',
    icon: Vault,
    module: 'Controle Financeiro',
    subModule: 'Registros',
  },

  // Security Module
  '/security/dashboard': {
    label: 'Dashboard',
    icon: LayoutDashboard,
    module: 'Segurança',
  },
  '/security/passwords': { label: 'Senhas', icon: Key, module: 'Segurança' },
  '/security/stored-cards': {
    label: 'Cartões Armazenados',
    icon: CreditCard,
    module: 'Segurança',
  },
  '/security/stored-accounts': {
    label: 'Contas Armazenadas',
    icon: Wallet,
    module: 'Segurança',
  },
  '/security/archives': { label: 'Arquivos', icon: Archive, module: 'Segurança' },

  // Library Module
  '/library/dashboard': {
    label: 'Dashboard',
    icon: LayoutDashboard,
    module: 'Leitura',
  },
  '/library/books': { label: 'Livros', icon: BookOpen, module: 'Leitura' },
  '/library/authors': { label: 'Autores', icon: UserPen, module: 'Leitura' },
  '/library/publishers': { label: 'Editoras', icon: Building2, module: 'Leitura' },
  '/library/summaries': { label: 'Resumos', icon: FileText, module: 'Leitura' },
  '/library/readings': { label: 'Leituras', icon: BookMarked, module: 'Leitura' },
};

const moduleIcons: Record<string, LucideIcon> = {
  'Planejamento Pessoal': Calendar,
  'Controle Financeiro': Wallet,
  Segurança: Shield,
  Leitura: Library,
};

const subModuleIcons: Record<string, LucideIcon> = {
  Cadastros: FolderOpen,
  Registros: ClipboardList,
};

/**
 * Hook para gerar breadcrumbs de navegação baseado na rota atual.
 *
 * @returns Array de items de breadcrumb com label, href e icon
 *
 * @example
 * ```tsx
 * const { breadcrumbs, currentPage } = useBreadcrumb();
 * // Para /accounts: [{ label: 'Início', href: '/' }, { label: 'Controle Financeiro' }, { label: 'Cadastros' }, { label: 'Contas' }]
 * ```
 */
export function useBreadcrumb() {
  const location = useLocation();

  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    const pathname = location.pathname;
    const config = routeConfigs[pathname];

    if (!config) {
      return [{ label: 'Início', href: '/', icon: Home }];
    }

    const items: BreadcrumbItem[] = [{ label: 'Início', href: '/', icon: Home }];

    // Adiciona módulo se existir
    if (config.module) {
      items.push({
        label: config.module,
        icon: moduleIcons[config.module],
      });
    }

    // Adiciona submódulo se existir
    if (config.subModule) {
      items.push({
        label: config.subModule,
        icon: subModuleIcons[config.subModule],
      });
    }

    // Adiciona página atual (sem link)
    if (pathname !== '/') {
      items.push({
        label: config.label,
        icon: config.icon,
      });
    }

    return items;
  }, [location.pathname]);

  const currentPage = useMemo(() => {
    const config = routeConfigs[location.pathname];
    return config?.label || 'Página';
  }, [location.pathname]);

  return { breadcrumbs, currentPage };
}
