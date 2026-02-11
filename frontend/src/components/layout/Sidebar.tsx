import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebar } from '@/hooks/use-sidebar';
import { useThemeAssets } from '@/hooks/use-theme-assets';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  X,
  Wallet,
  Shield,
  Library,
  ChevronDown,
  CreditCard,
  Receipt,
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
  BookMarked,
  FileText,
  Home,
  Calendar,
  Target,
  CheckCircle2,
  Users,
  FolderOpen,
  ClipboardList,
  Vault,
  Bot,
  Wand2,
} from 'lucide-react';

interface NavSubItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  permission?: {
    appName: string;
    action: string;
  };
}

interface NavSubModule {
  title: string;
  icon: React.ReactNode;
  items: NavSubItem[];
}

interface NavModule {
  title: string;
  icon: React.ReactNode;
  items?: NavSubItem[];
  subModules?: NavSubModule[];
  topItems?: NavSubItem[]; // Items that appear at top without submodule
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  permission?: {
    appName: string;
    action: string;
  };
}

const navItems: NavItem[] = [
  {
    title: 'Início',
    href: '/',
    icon: <Home className="w-5 h-5" />,
  },
  {
    title: 'Assistente IA',
    href: '/ai-assistant',
    icon: <Bot className="w-5 h-5" />,
  },
];

const navModules: NavModule[] = [
  {
    title: 'Planejamento Pessoal',
    icon: <Calendar className="w-5 h-5" />,
    items: [
      { title: 'Dashboard', href: '/planning/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { title: 'Checklist Diário', href: '/planning/daily', icon: <CheckCircle2 className="w-4 h-4" /> },
      { title: 'Tarefas Rotineiras', href: '/planning/routine-tasks', icon: <Calendar className="w-4 h-4" /> },
      { title: 'Objetivos', href: '/planning/goals', icon: <Target className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Controle Financeiro',
    icon: <Wallet className="w-5 h-5" />,
    topItems: [
      { title: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    ],
    subModules: [
      {
        title: 'Cadastros',
        icon: <FolderOpen className="w-4 h-4" />,
        items: [
          { title: 'Contas', href: '/accounts', icon: <Wallet className="w-4 h-4" /> },
          { title: 'Cartões de Crédito', href: '/credit-cards', icon: <CreditCard className="w-4 h-4" /> },
          { title: 'Faturas', href: '/credit-card-bills', icon: <Receipt className="w-4 h-4" /> },
          { title: 'Gastos Fixos', href: '/fixed-expenses', icon: <CalendarClock className="w-4 h-4" /> },
          { title: 'Valores a Pagar', href: '/payables', icon: <Receipt className="w-4 h-4" /> },
          { title: 'Metas Financeiras', href: '/financial-goals', icon: <Target className="w-4 h-4" /> },
          { title: 'Beneficiários/Credores', href: '/members', icon: <Users className="w-4 h-4" /> },
        ],
      },
      {
        title: 'Registros',
        icon: <ClipboardList className="w-4 h-4" />,
        items: [
          { title: 'Despesas', href: '/expenses', icon: <TrendingDown className="w-4 h-4" /> },
          { title: 'Receitas', href: '/revenues', icon: <TrendingUp className="w-4 h-4" /> },
          { title: 'Gastos do Cartão', href: '/credit-card-expenses', icon: <ShoppingCart className="w-4 h-4" /> },
          { title: 'Transferências', href: '/transfers', icon: <ArrowLeftRight className="w-4 h-4" /> },
          { title: 'Empréstimos', href: '/loans', icon: <HandCoins className="w-4 h-4" /> },
          { title: 'Cofres', href: '/vaults', icon: <Vault className="w-4 h-4" /> },
        ],
      },
    ],
  },
  {
    title: 'Segurança',
    icon: <Shield className="w-5 h-5" />,
    items: [
      { title: 'Dashboard', href: '/security/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { title: 'Senhas', href: '/security/passwords', icon: <Key className="w-4 h-4" /> },
      { title: 'Cartões Armazenados', href: '/security/stored-cards', icon: <CreditCard className="w-4 h-4" /> },
      { title: 'Contas Armazenadas', href: '/security/stored-accounts', icon: <Wallet className="w-4 h-4" /> },
      { title: 'Gerador de Senhas', href: '/security/password-generator', icon: <Wand2 className="w-4 h-4" /> },
      { title: 'Arquivos', href: '/security/archives', icon: <Archive className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Leitura',
    icon: <Library className="w-5 h-5" />,
    items: [
      { title: 'Dashboard', href: '/library/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { title: 'Livros', href: '/library/books', icon: <BookOpen className="w-4 h-4" /> },
      { title: 'Autores', href: '/library/authors', icon: <UserPen className="w-4 h-4" /> },
      { title: 'Editoras', href: '/library/publishers', icon: <Building2 className="w-4 h-4" /> },
      { title: 'Resumos', href: '/library/summaries', icon: <FileText className="w-4 h-4" /> },
      { title: 'Leituras', href: '/library/readings', icon: <BookMarked className="w-4 h-4" /> },
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
  // Accordion: apenas um módulo expandido por vez
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  // Accordion para submódulos: apenas um submódulo expandido por vez dentro de cada módulo
  const [expandedSubModule, setExpandedSubModule] = useState<string | null>(null);

  const filteredNavItems = navItems.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(item.permission.appName, item.permission.action);
  });

  // Toggle módulo com comportamento accordion (fecha os outros)
  const toggleModule = (moduleTitle: string) => {
    setExpandedModule((prev) => (prev === moduleTitle ? null : moduleTitle));
    // Ao trocar de módulo, fecha o submódulo expandido
    setExpandedSubModule(null);
  };

  const isModuleExpanded = (moduleTitle: string) => {
    return expandedModule === moduleTitle;
  };

  // Toggle submódulo com comportamento accordion (fecha os outros)
  const toggleSubModule = (subModuleTitle: string) => {
    setExpandedSubModule((prev) => (prev === subModuleTitle ? null : subModuleTitle));
  };

  const isSubModuleExpanded = (subModuleTitle: string) => {
    return expandedSubModule === subModuleTitle;
  };

  // Auto-expand module and submodule if current route is within it
  useEffect(() => {
    navModules.forEach((module) => {
      const allItems = getAllModuleItems(module);
      const isActive = allItems.some((item) => location.pathname === item.href);
      if (isActive) {
        setExpandedModule(module.title);
        // Verificar se está em um submódulo
        if (module.subModules) {
          module.subModules.forEach((sub) => {
            const isSubActive = sub.items.some((item) => location.pathname === item.href);
            if (isSubActive) {
              setExpandedSubModule(sub.title);
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
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50',
          'w-72 bg-card border-r min-h-screen p-4',
          'flex flex-col',
          'transform transition-transform duration-300 ease-in-out lg:transform-none',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden">
              <img src={icon} alt="MindLedger" className="w-10 h-10 object-contain" />
            </div>
            <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              MindLedger
            </span>
          </Link>

          {/* Botão fechar (apenas mobile) */}
          <button
            onClick={close}
            className="lg:hidden p-2 hover:bg-accent rounded-lg transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <nav className="space-y-2 flex-1 overflow-y-auto custom-scrollbar" aria-label="Menu principal">
        {/* Items principais */}
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'sidebar-text hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {item.icon}
              <span>{item.title}</span>
            </Link>
          );
        })}

        {/* Divisória */}
        <div className="border-t my-2" />

        {/* Módulos com submenus */}
        {navModules.map((module) => {
          const isExpanded = isModuleExpanded(module.title);
          const allItems = getAllModuleItems(module);
          const hasActiveItem = allItems.some((item) => location.pathname === item.href);

          return (
            <div key={module.title} className="space-y-1">
              {/* Cabeçalho do módulo */}
              <button
                onClick={() => toggleModule(module.title)}
                aria-expanded={isExpanded}
                aria-controls={`module-${module.title.replace(/\s+/g, '-').toLowerCase()}`}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 w-full',
                  hasActiveItem
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'sidebar-text hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {module.icon}
                <span className="flex-1 text-left">{module.title}</span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 transition-transform duration-200',
                    isExpanded ? 'rotate-0' : '-rotate-90'
                  )}
                />
              </button>

              {/* Conteúdo expandível com animação */}
              <div
                id={`module-${module.title.replace(/\s+/g, '-').toLowerCase()}`}
                className={cn(
                  'grid transition-all duration-200 ease-in-out',
                  isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
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
                            'flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-150 text-sm',
                            isActive
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'sidebar-text hover:bg-accent hover:text-accent-foreground'
                          )}
                        >
                          {item.icon}
                          <span>{item.title}</span>
                        </Link>
                      );
                    })}

                    {/* Submódulos */}
                    {module.subModules?.map((subModule) => {
                      const isSubExpanded = isSubModuleExpanded(subModule.title);
                      const hasSubActiveItem = subModule.items.some(
                        (item) => location.pathname === item.href
                      );

                      return (
                        <div key={subModule.title} className="space-y-1">
                          {/* Cabeçalho do submódulo */}
                          <button
                            onClick={() => toggleSubModule(subModule.title)}
                            aria-expanded={isSubExpanded}
                            aria-controls={`submodule-${subModule.title.replace(/\s+/g, '-').toLowerCase()}`}
                            className={cn(
                              'flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-150 w-full text-sm',
                              isSubExpanded
                                ? 'bg-primary/10 text-primary font-medium'
                                : hasSubActiveItem
                                  ? 'bg-accent/50 text-accent-foreground font-medium'
                                  : 'sidebar-text hover:bg-accent hover:text-accent-foreground'
                            )}
                          >
                            <span className={cn(
                              'transition-colors duration-150',
                              isSubExpanded ? 'text-primary' : ''
                            )}>
                              {subModule.icon}
                            </span>
                            <span className="flex-1 text-left">{subModule.title}</span>
                            <ChevronDown
                              className={cn(
                                'w-3 h-3 transition-transform duration-200',
                                isSubExpanded ? 'rotate-0' : '-rotate-90'
                              )}
                            />
                          </button>

                          {/* Itens do submódulo com animação */}
                          <div
                            id={`submodule-${subModule.title.replace(/\s+/g, '-').toLowerCase()}`}
                            className={cn(
                              'grid transition-all duration-200 ease-in-out',
                              isSubExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
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
                                        'flex items-center gap-3 px-3 py-1.5 rounded-lg transition-all duration-150 text-sm',
                                        isActive
                                          ? 'bg-primary text-primary-foreground font-medium'
                                          : 'sidebar-text hover:bg-accent hover:text-accent-foreground'
                                      )}
                                    >
                                      {item.icon}
                                      <span>{item.title}</span>
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
                            'flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-150 text-sm',
                            isActive
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'sidebar-text hover:bg-accent hover:text-accent-foreground'
                          )}
                        >
                          {item.icon}
                          <span>{item.title}</span>
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
