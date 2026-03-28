import {
  LayoutDashboard,
  X,
  Wallet,
  Shield,
  Library,
  ChevronDown,
  CreditCard,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  CalendarClock,
  ArrowLeftRight,
  HandCoins,
  Archive,
  Key,
  BookOpen,
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
  Bell,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { useSidebar } from '@/hooks/use-sidebar';
import { useThemeAssets } from '@/hooks/use-theme-assets';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

interface NavSubItem {
  titleKey: string;
  href: string;
  icon: React.ReactNode;
  permission?: {
    appName: string;
    action: string;
  };
}

interface NavSubModule {
  id: string;
  titleKey: string;
  icon: React.ReactNode;
  items: NavSubItem[];
}

interface NavModule {
  id: string;
  titleKey: string;
  icon: React.ReactNode;
  items?: NavSubItem[];
  subModules?: NavSubModule[];
  topItems?: NavSubItem[];
}

interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ReactNode;
  permission?: {
    appName: string;
    action: string;
  };
}

const navItems: NavItem[] = [
  {
    titleKey: 'nav.home',
    href: '/',
    icon: <Home className="h-5 w-5" />,
  },
  {
    titleKey: 'nav.notificationPreferences',
    href: '/settings/notifications',
    icon: <Bell className="h-5 w-5" />,
  },
];

const navModules: NavModule[] = [
  {
    id: 'planning',
    titleKey: 'nav.modules.planning',
    icon: <Calendar className="h-5 w-5" />,
    items: [
      {
        titleKey: 'nav.dashboard',
        href: '/planning/dashboard',
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        titleKey: 'nav.items.todayTasks',
        href: '/planning/today-tasks',
        icon: <CheckCircle2 className="h-4 w-4" />,
      },
      {
        titleKey: 'nav.items.routineTasks',
        href: '/planning/routine-tasks',
        icon: <Calendar className="h-4 w-4" />,
      },
      {
        titleKey: 'nav.items.goals',
        href: '/planning/goals',
        icon: <Target className="h-4 w-4" />,
      },
    ],
  },
  {
    id: 'finance',
    titleKey: 'nav.modules.finance',
    icon: <Wallet className="h-5 w-5" />,
    topItems: [
      {
        titleKey: 'nav.dashboard',
        href: '/dashboard',
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
    ],
    subModules: [
      {
        id: 'finance-registrations',
        titleKey: 'nav.submodules.registrations',
        icon: <FolderOpen className="h-4 w-4" />,
        items: [
          {
            titleKey: 'nav.items.accounts',
            href: '/accounts',
            icon: <Wallet className="h-4 w-4" />,
          },
          {
            titleKey: 'nav.items.creditCards',
            href: '/credit-cards',
            icon: <CreditCard className="h-4 w-4" />,
          },
          {
            titleKey: 'nav.items.fixedExpenses',
            href: '/fixed-expenses',
            icon: <CalendarClock className="h-4 w-4" />,
          },
          {
            titleKey: 'nav.items.categorizationRules',
            href: '/categorization-rules',
            icon: <Tag className="h-4 w-4" />,
          },
          {
            titleKey: 'nav.items.budgets',
            href: '/budgets',
            icon: <PiggyBank className="h-4 w-4" />,
          },
          {
            titleKey: 'nav.items.payables',
            href: '/payables',
            icon: <Receipt className="h-4 w-4" />,
          },
          {
            titleKey: 'nav.items.financialGoals',
            href: '/financial-goals',
            icon: <Target className="h-4 w-4" />,
          },
          {
            titleKey: 'nav.items.members',
            href: '/members',
            icon: <Users className="h-4 w-4" />,
          },
        ],
      },
      {
        id: 'finance-records',
        titleKey: 'nav.submodules.records',
        icon: <ClipboardList className="h-4 w-4" />,
        items: [
          {
            titleKey: 'nav.items.expenses',
            href: '/expenses',
            icon: <TrendingDown className="h-4 w-4" />,
          },
          {
            titleKey: 'nav.items.revenues',
            href: '/revenues',
            icon: <TrendingUp className="h-4 w-4" />,
          },
          {
            titleKey: 'nav.items.creditCardExpenses',
            href: '/credit-card-expenses',
            icon: <ShoppingCart className="h-4 w-4" />,
          },
          {
            titleKey: 'nav.items.transfers',
            href: '/transfers',
            icon: <ArrowLeftRight className="h-4 w-4" />,
          },
          {
            titleKey: 'nav.items.loans',
            href: '/loans',
            icon: <HandCoins className="h-4 w-4" />,
          },
          {
            titleKey: 'nav.items.vaults',
            href: '/vaults',
            icon: <Vault className="h-4 w-4" />,
          },
        ],
      },
    ],
  },
  {
    id: 'security',
    titleKey: 'nav.modules.security',
    icon: <Shield className="h-5 w-5" />,
    items: [
      {
        titleKey: 'nav.dashboard',
        href: '/security/dashboard',
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        titleKey: 'nav.items.passwords',
        href: '/security/passwords',
        icon: <Key className="h-4 w-4" />,
      },
      {
        titleKey: 'nav.items.storedCards',
        href: '/security/stored-cards',
        icon: <CreditCard className="h-4 w-4" />,
      },
      {
        titleKey: 'nav.items.storedAccounts',
        href: '/security/stored-accounts',
        icon: <Wallet className="h-4 w-4" />,
      },
      {
        titleKey: 'nav.items.archives',
        href: '/security/archives',
        icon: <Archive className="h-4 w-4" />,
      },
    ],
  },
  {
    id: 'library',
    titleKey: 'nav.modules.library',
    icon: <Library className="h-5 w-5" />,
    items: [
      {
        titleKey: 'nav.dashboard',
        href: '/library/dashboard',
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        titleKey: 'nav.items.books',
        href: '/library/books',
        icon: <BookOpen className="h-4 w-4" />,
      },
      {
        titleKey: 'nav.items.authors',
        href: '/library/authors',
        icon: <UserPen className="h-4 w-4" />,
      },
      {
        titleKey: 'nav.items.publishers',
        href: '/library/publishers',
        icon: <Building2 className="h-4 w-4" />,
      },
    ],
  },
];

// Helper function to get all items from a module (including subModules and topItems)
const getAllModuleItems = (module: NavModule): NavSubItem[] => {
  const items: NavSubItem[] = [];
  if (module.items) items.push(...module.items);
  if (module.topItems) items.push(...module.topItems);
  if (module.subModules) {
    module.subModules.forEach((sub) => items.push(...sub.items));
  }
  return items;
};

export const Sidebar = () => {
  const location = useLocation();
  const { hasPermission } = useAuthStore();
  const { isOpen, close } = useSidebar();
  const { icon } = useThemeAssets();
  const { t } = useTranslation();
  // Accordion: apenas um módulo expandido por vez
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  // Accordion para submódulos: apenas um submódulo expandido por vez dentro de cada módulo
  const [expandedSubModule, setExpandedSubModule] = useState<string | null>(null);

  const filteredNavItems = navItems.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(item.permission.appName, item.permission.action);
  });

  // Toggle módulo com comportamento accordion (fecha os outros)
  const toggleModule = (moduleId: string) => {
    setExpandedModule((prev) => (prev === moduleId ? null : moduleId));
    // Ao trocar de módulo, fecha o submódulo expandido
    setExpandedSubModule(null);
  };

  const isModuleExpanded = (moduleId: string) => {
    return expandedModule === moduleId;
  };

  // Toggle submódulo com comportamento accordion (fecha os outros)
  const toggleSubModule = (subModuleId: string) => {
    setExpandedSubModule((prev) => (prev === subModuleId ? null : subModuleId));
  };

  const isSubModuleExpanded = (subModuleId: string) => {
    return expandedSubModule === subModuleId;
  };

  // Auto-expand module and submodule if current route is within it
  useEffect(() => {
    navModules.forEach((module) => {
      const allItems = getAllModuleItems(module);
      const isActive = allItems.some((item) => location.pathname === item.href);
      if (isActive) {
        setExpandedModule(module.id);
        // Verificar se está em um submódulo
        if (module.subModules) {
          module.subModules.forEach((sub) => {
            const isSubActive = sub.items.some(
              (item) => location.pathname === item.href
            );
            if (isSubActive) {
              setExpandedSubModule(sub.id);
            }
          });
        }
      }
    });
  }, [location.pathname]);

  // Fechar sidebar ao mudar de rota em mobile
  useEffect(() => {
    close();
  }, [location.pathname, close]);

  // Prevenir scroll do body quando sidebar mobile está aberta
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      {/* Overlay para mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 md:sticky md:top-0',
          'h-screen w-72 border-r bg-card p-4',
          'flex flex-col',
          'transform transition-transform duration-300 ease-in-out md:transform-none',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg">
                <img src={icon} alt="MindLedger" className="h-10 w-10 object-contain" />
              </div>
              <span className="bg-gradient-primary bg-clip-text text-xl font-bold text-transparent">
                MindLedger
              </span>
            </Link>

            {/* Botão fechar (apenas mobile) */}
            <button
              onClick={close}
              className="rounded-lg p-2 transition-colors hover:bg-accent md:hidden"
              aria-label={t('layout.closeMenu')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav
          className="custom-scrollbar flex-1 space-y-2 overflow-y-auto"
          aria-label={t('layout.mainMenu')}
        >
          {/* Items principais */}
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.href;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-4 py-3 transition-colors',
                  isActive
                    ? 'bg-primary font-medium text-primary-foreground'
                    : 'sidebar-text hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {item.icon}
                <span>{t(item.titleKey)}</span>
              </Link>
            );
          })}

          {/* Divisória */}
          <div className="my-2 border-t" />

          {/* Módulos com submenus */}
          {navModules.map((module) => {
            const isExpanded = isModuleExpanded(module.id);
            const allItems = getAllModuleItems(module);
            const hasActiveItem = allItems.some(
              (item) => location.pathname === item.href
            );

            return (
              <div key={module.id} className="space-y-1">
                {/* Cabeçalho do módulo */}
                <button
                  onClick={() => toggleModule(module.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`module-${module.id}`}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200',
                    hasActiveItem
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'sidebar-text hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {module.icon}
                  <span className="flex-1 text-left">{t(module.titleKey)}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      isExpanded ? 'rotate-0' : '-rotate-90'
                    )}
                  />
                </button>

                {/* Conteúdo expandível com animação */}
                <div
                  id={`module-${module.id}`}
                  className={cn(
                    'grid transition-all duration-200 ease-in-out',
                    isExpanded
                      ? 'grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0'
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="ml-4 space-y-1 py-1">
                      {/* Top Items (sem submódulo, ex: Dashboard) */}
                      {module.topItems?.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                              'flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition-all duration-150',
                              isActive
                                ? 'bg-primary font-medium text-primary-foreground'
                                : 'sidebar-text hover:bg-accent hover:text-accent-foreground'
                            )}
                          >
                            {item.icon}
                            <span>{t(item.titleKey)}</span>
                          </Link>
                        );
                      })}

                      {/* Submódulos */}
                      {module.subModules?.map((subModule) => {
                        const isSubExpanded = isSubModuleExpanded(subModule.id);
                        const hasSubActiveItem = subModule.items.some(
                          (item) => location.pathname === item.href
                        );

                        return (
                          <div key={subModule.id} className="space-y-1">
                            {/* Cabeçalho do submódulo */}
                            <button
                              onClick={() => toggleSubModule(subModule.id)}
                              aria-expanded={isSubExpanded}
                              aria-controls={`submodule-${subModule.id}`}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-lg px-4 py-2 text-sm transition-all duration-150',
                                isSubExpanded
                                  ? 'bg-primary/10 font-medium text-primary'
                                  : hasSubActiveItem
                                    ? 'bg-accent/50 font-medium text-accent-foreground'
                                    : 'sidebar-text hover:bg-accent hover:text-accent-foreground'
                              )}
                            >
                              <span
                                className={cn(
                                  'transition-colors duration-150',
                                  isSubExpanded ? 'text-primary' : ''
                                )}
                              >
                                {subModule.icon}
                              </span>
                              <span className="flex-1 text-left">
                                {t(subModule.titleKey)}
                              </span>
                              <ChevronDown
                                className={cn(
                                  'h-3 w-3 transition-transform duration-200',
                                  isSubExpanded ? 'rotate-0' : '-rotate-90'
                                )}
                              />
                            </button>

                            {/* Itens do submódulo com animação */}
                            <div
                              id={`submodule-${subModule.id}`}
                              className={cn(
                                'grid transition-all duration-200 ease-in-out',
                                isSubExpanded
                                  ? 'grid-rows-[1fr] opacity-100'
                                  : 'grid-rows-[0fr] opacity-0'
                              )}
                            >
                              <div className="overflow-hidden">
                                <div className="ml-4 space-y-1 py-1">
                                  {subModule.items.map((item) => {
                                    const isActive = location.pathname === item.href;
                                    return (
                                      <Link
                                        key={item.href}
                                        to={item.href}
                                        className={cn(
                                          'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-all duration-150',
                                          isActive
                                            ? 'bg-primary font-medium text-primary-foreground'
                                            : 'sidebar-text hover:bg-accent hover:text-accent-foreground'
                                        )}
                                      >
                                        {item.icon}
                                        <span>{t(item.titleKey)}</span>
                                      </Link>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Items normais (módulos sem submódulos) */}
                      {module.items?.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                              'flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition-all duration-150',
                              isActive
                                ? 'bg-primary font-medium text-primary-foreground'
                                : 'sidebar-text hover:bg-accent hover:text-accent-foreground'
                            )}
                          >
                            {item.icon}
                            <span>{t(item.titleKey)}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
