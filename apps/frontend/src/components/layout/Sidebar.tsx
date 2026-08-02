/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Flame,
  X,
  PanelLeftClose,
  PanelLeft,
  Settings,
  LogOut,
} from 'lucide-react';
import { useEffect, useReducer, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import {
  navItems,
  navModules,
  getAllModuleItems,
  isPathActive,
  type NavModule,
  type NavSubItem,
} from '@/config/nav-config';
import { prefetchRoute } from '@/config/route-prefetch';
import { useSidebar, useIsMobile } from '@/hooks/use-sidebar';
import { useThemeAssets } from '@/hooks/use-theme-assets';
import { APP_ENV, APP_VERSION, IS_PRODUCTION } from '@/lib/app-info';
import { cn } from '@/lib/utils';
import { libraryDashboardService } from '@/services/library-dashboard-service';
import { useAuthStore } from '@/stores/auth-store';

// ── Accordion state via reducer ───────────────────────────────────────────────

interface AccordionState {
  module: string | null;
  subModule: string | null;
}

type AccordionAction =
  | { type: 'TOGGLE_MODULE'; id: string }
  | { type: 'TOGGLE_SUBMODULE'; id: string }
  | { type: 'SET_FROM_ROUTE'; moduleId: string; subModuleId?: string }
  | { type: 'EXPAND_MODULE'; id: string };

function accordionReducer(
  state: AccordionState,
  action: AccordionAction
): AccordionState {
  switch (action.type) {
    case 'TOGGLE_MODULE':
      return { module: state.module === action.id ? null : action.id, subModule: null };
    case 'TOGGLE_SUBMODULE':
      return { ...state, subModule: state.subModule === action.id ? null : action.id };
    case 'SET_FROM_ROUTE':
      return {
        module: action.moduleId,
        subModule: action.subModuleId ?? state.subModule,
      };
    case 'EXPAND_MODULE':
      return { ...state, module: action.id };
    default:
      return state;
  }
}

// ── NavLink ───────────────────────────────────────────────────────────────────

interface NavLinkProps {
  item: NavSubItem;
  isCollapsed: boolean;
  indent?: 'sm' | 'md';
  onClick?: () => void;
}

function NavLink({ item, isCollapsed, indent = 'md', onClick }: NavLinkProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const active = isPathActive(item.href, location.pathname);
  const Icon = item.icon;

  const base = cn(
    'relative flex items-center gap-3 rounded-lg transition-all duration-150',
    active
      ? 'bg-primary/10 font-medium text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
      : 'sidebar-text hover:bg-accent/60 hover:text-accent-foreground',
    isCollapsed
      ? 'justify-center px-0 py-sm'
      : indent === 'sm'
        ? 'px-3 py-sm'
        : 'px-md py-sm',
    isCollapsed ? 'w-10 h-10' : 'text-sm'
  );

  const link = (
    <Link
      to={item.href}
      className={base}
      onClick={onClick}
      onMouseEnter={() => prefetchRoute(item.href)}
      aria-current={active ? 'page' : undefined}
    >
      <Icon
        className={cn('shrink-0', isCollapsed ? 'h-5 w-5' : 'h-4 w-4')}
        aria-hidden="true"
      />
      <AnimatePresence>
        {!isCollapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="truncate"
          >
            {t(item.titleKey)}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip content={t(item.titleKey)} side="right">
        {link}
      </Tooltip>
    );
  }

  return link;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission, user, logout } = useAuthStore();
  const { isOpen, isCollapsed, close, toggleCollapsed } = useSidebar();
  const isMobile = useIsMobile();
  const { icon } = useThemeAssets();
  const { t } = useTranslation();
  const navRef = useRef<HTMLElement>(null);

  const [expanded, dispatch] = useReducer(accordionReducer, {
    module: null,
    subModule: null,
  });

  const { data: streakData } = useQuery({
    queryKey: ['library', 'streak'],
    queryFn: () => libraryDashboardService.getStreak(),
    staleTime: 30_000,
    retry: false,
  });

  const filteredNavItems = navItems.filter(
    (item) =>
      !item.permission || hasPermission(item.permission.appName, item.permission.action)
  );

  // Auto-expand the active module + submodule on route change
  useEffect(() => {
    navModules.forEach((module) => {
      const allItems = getAllModuleItems(module);
      const isActive = allItems.some((item) =>
        isPathActive(item.href, location.pathname)
      );
      if (!isActive) return;

      let subModuleId: string | undefined;
      if (module.subModules) {
        module.subModules.forEach((sub) => {
          const isSubActive = sub.items.some((item) =>
            isPathActive(item.href, location.pathname)
          );
          if (isSubActive) subModuleId = sub.id;
        });
      }
      dispatch({ type: 'SET_FROM_ROUTE', moduleId: module.id, subModuleId });
    });
  }, [location.pathname]);

  // Close mobile sidebar on route change
  useEffect(() => {
    close();
  }, [location.pathname, close]);

  // Prevent body scroll while mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Focus first nav link when mobile sidebar opens
  useEffect(() => {
    if (isOpen && isMobile) {
      const first = navRef.current?.querySelector<HTMLElement>('a, button');
      first?.focus();
    }
  }, [isOpen, isMobile]);

  // Keyboard: Ctrl/Cmd+B toggles collapsed on desktop
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        if (!isMobile) toggleCollapsed();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMobile, toggleCollapsed]);

  const handleModuleClick = (moduleId: string) => {
    if (isCollapsed) {
      // Expand sidebar first, then open the module
      toggleCollapsed();
      dispatch({ type: 'EXPAND_MODULE', id: moduleId });
    } else {
      dispatch({ type: 'TOGGLE_MODULE', id: moduleId });
    }
  };

  const renderModule = (module: NavModule) => {
    const isExpanded = expanded.module === module.id;
    const allItems = getAllModuleItems(module);
    const hasActiveItem = allItems.some((item) =>
      isPathActive(item.href, location.pathname)
    );
    const Icon = module.icon;
    const streak =
      module.id === 'library' && streakData && streakData.current > 0
        ? streakData.current
        : null;

    return (
      <div key={module.id} className="space-y-xs">
        {/* Module header button */}
        {isCollapsed ? (
          <Tooltip
            content={
              streak ? `${t(module.titleKey)} · ${streak} dias` : t(module.titleKey)
            }
            side="right"
          >
            <button
              onClick={() => handleModuleClick(module.id)}
              aria-label={t(module.titleKey)}
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-150',
                hasActiveItem
                  ? 'text-primary font-medium'
                  : 'sidebar-text hover:bg-accent/60 hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {streak && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-0.5 text-[9px] font-bold text-white">
                  {streak}
                </span>
              )}
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={() => handleModuleClick(module.id)}
            aria-expanded={isExpanded}
            aria-controls={`module-${module.id}`}
            className={cn(
              'px-md py-sm flex w-full items-center gap-3 rounded-lg text-sm transition-all duration-200',
              hasActiveItem
                ? 'text-primary font-medium'
                : 'sidebar-text hover:bg-accent/60 hover:text-accent-foreground'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">{t(module.titleKey)}</span>
            {streak && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-orange-500">
                <Flame className="h-3 w-3" aria-hidden="true" />
                {streak}
              </span>
            )}
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 transition-transform duration-200',
                isExpanded ? 'rotate-0' : 'rotate-90'
              )}
              aria-hidden="true"
            />
          </button>
        )}

        {/* Collapsible content (desktop expanded mode only) */}
        {!isCollapsed && (
          <div
            id={`module-${module.id}`}
            className={cn(
              'grid transition-all duration-200 ease-in-out',
              isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            )}
          >
            <div className="overflow-hidden">
              <div className="ml-md space-y-xs py-xs">
                {module.topItems?.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    isCollapsed={false}
                    indent="md"
                  />
                ))}

                {module.subModules?.map((subModule) => {
                  const isSubExpanded = expanded.subModule === subModule.id;
                  const hasSubActiveItem = subModule.items.some((item) =>
                    isPathActive(item.href, location.pathname)
                  );
                  const SubIcon = subModule.icon;

                  return (
                    <div key={subModule.id} className="space-y-xs">
                      <button
                        onClick={() =>
                          dispatch({ type: 'TOGGLE_SUBMODULE', id: subModule.id })
                        }
                        aria-expanded={isSubExpanded}
                        aria-controls={`submodule-${subModule.id}`}
                        className={cn(
                          'px-md py-sm flex w-full items-center gap-3 rounded-lg text-sm transition-all duration-150',
                          isSubExpanded
                            ? 'bg-primary/10 text-primary font-medium'
                            : hasSubActiveItem
                              ? 'bg-accent/50 text-accent-foreground font-medium'
                              : 'sidebar-text hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <SubIcon
                          className={cn(
                            'h-4 w-4 shrink-0 transition-colors duration-150',
                            isSubExpanded ? 'text-primary' : ''
                          )}
                          aria-hidden="true"
                        />
                        <span className="flex-1 text-left">
                          {t(subModule.titleKey)}
                        </span>
                        <ChevronDown
                          className={cn(
                            'h-3 w-3 shrink-0 transition-transform duration-200',
                            isSubExpanded ? 'rotate-0' : 'rotate-90'
                          )}
                          aria-hidden="true"
                        />
                      </button>

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
                          <div className="ml-md space-y-xs py-xs">
                            {subModule.items.map((item) => (
                              <NavLink
                                key={item.href}
                                item={item}
                                isCollapsed={false}
                                indent="sm"
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {module.items?.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    isCollapsed={false}
                    indent="md"
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Desktop collapsed icon grid ─────────────────────────────────────────────
  const collapsedNav = (
    <div className="gap-xs py-xs flex flex-col items-center">
      {filteredNavItems.map((item) => (
        <NavLink key={item.href} item={item} isCollapsed={true} />
      ))}
      <div className="my-xs border-border/40 w-8 border-t" />
      {navModules.map((module) => renderModule(module))}
    </div>
  );

  // ── Sidebar content ──────────────────────────────────────────────────────────
  const sidebarContent = (
    <>
      {/* Logo */}
      <div
        className={cn(
          'mb-lg flex items-center',
          isCollapsed && !isMobile ? 'justify-center' : 'justify-between'
        )}
      >
        <Link to="/" className="gap-sm flex items-center" aria-label={t('nav.home')}>
          <div className="ring-border/50 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1">
            <img
              src={icon}
              alt=""
              className="h-9 w-9 object-contain"
              aria-hidden="true"
            />
          </div>
          <AnimatePresence>
            {(!isCollapsed || isMobile) && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="text-foreground text-lg font-semibold tracking-tight"
              >
                Axiom
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {/* Mobile close button */}
        {isMobile && (
          <button
            onClick={close}
            className="p-sm hover:bg-accent rounded-lg transition-colors"
            aria-label={t('layout.closeMenu')}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        ref={navRef}
        className="custom-scrollbar flex-1 overflow-y-auto"
        aria-label={t('layout.mainMenu')}
      >
        {isCollapsed && !isMobile ? (
          collapsedNav
        ) : (
          <div className="space-y-sm">
            {filteredNavItems.map((item) => (
              <NavLink key={item.href} item={item} isCollapsed={false} />
            ))}

            <div className="my-sm border-border/40 border-t" />

            <p className="px-md pb-xs text-muted-foreground/60 text-[10px] font-semibold tracking-widest uppercase">
              {t('layout.sectionModules')}
            </p>

            {navModules.map((module) => renderModule(module))}
          </div>
        )}
      </nav>

      {/* User profile — dropdown with Settings + Logout */}
      {user && (
        <div
          className={cn(
            'mt-sm border-border/40 pt-sm border-t',
            isCollapsed && !isMobile ? 'flex justify-center' : ''
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {isCollapsed && !isMobile ? (
                <Tooltip
                  content={
                    `${user.first_name} ${user.last_name}`.trim() || user.username
                  }
                  side="right"
                >
                  <button
                    className="bg-primary/10 ring-border/50 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 transition-opacity hover:opacity-80"
                    aria-label={t('layout.userMenu')}
                  >
                    {user.profile_photo ? (
                      <img
                        src={user.profile_photo}
                        alt=""
                        className="h-full w-full object-cover"
                        aria-hidden="true"
                      />
                    ) : (
                      <span className="text-primary text-xs font-semibold">
                        {(
                          user.first_name?.[0] ??
                          user.username?.[0] ??
                          '?'
                        ).toUpperCase()}
                      </span>
                    )}
                  </button>
                </Tooltip>
              ) : (
                <button
                  className="gap-sm px-sm py-xs hover:bg-muted/60 flex w-full items-center rounded-lg transition-colors"
                  aria-label={t('layout.userMenu')}
                >
                  <div className="bg-primary/10 ring-border/50 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1">
                    {user.profile_photo ? (
                      <img
                        src={user.profile_photo}
                        alt=""
                        className="h-full w-full object-cover"
                        aria-hidden="true"
                      />
                    ) : (
                      <span className="text-primary text-xs font-semibold">
                        {(
                          user.first_name?.[0] ??
                          user.username?.[0] ??
                          '?'
                        ).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-foreground truncate text-sm font-medium">
                      {`${user.first_name} ${user.last_name}`.trim() || user.username}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {user.username}
                    </p>
                  </div>
                </button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52">
              <DropdownMenuItem
                onClick={() => void navigate('/settings/profile')}
                className="gap-sm"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                {t('layout.userSettings')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="gap-sm text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {t('layout.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Version info (desktop expanded only) */}
      {!isMobile && !isCollapsed && (
        <div className="mt-sm gap-xs flex items-center justify-center">
          <span className="text-muted-foreground/40 font-mono text-[10px] select-none">
            v{APP_VERSION}
          </span>
          {!IS_PRODUCTION && (
            <span
              className={cn(
                'px-xs rounded py-px text-[9px] font-bold tracking-wide uppercase select-none',
                APP_ENV === 'staging'
                  ? 'bg-orange-500/10 text-orange-500'
                  : 'bg-sky-500/10 text-sky-500'
              )}
            >
              {APP_ENV}
            </span>
          )}
        </div>
      )}

      {/* Collapse toggle (desktop only) */}
      {!isMobile && (
        <div
          className={cn(
            'mt-sm border-border/40 border-t pt-3',
            isCollapsed ? 'flex justify-center' : ''
          )}
        >
          <Tooltip
            content={
              isCollapsed ? t('layout.expandSidebar') : t('layout.collapseSidebar')
            }
            side="right"
          >
            <button
              onClick={toggleCollapsed}
              aria-label={
                isCollapsed ? t('layout.expandSidebar') : t('layout.collapseSidebar')
              }
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
            >
              {isCollapsed ? (
                <PanelLeft className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </Tooltip>
          {!isCollapsed && (
            <p className="mt-xs text-muted-foreground/60 text-center text-xs">⌘B</p>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="z-sidebar-overlay fixed inset-0 bg-black/50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          // positioning
          'z-sidebar fixed inset-y-0 left-0 md:sticky md:top-0',
          'border-border/50 bg-card flex h-screen flex-col border-r',
          // desktop width transition
          'transition-[width,padding] duration-300 ease-in-out',
          isCollapsed && !isMobile ? 'p-sm w-[3.75rem]' : 'p-md w-64',
          // mobile slide
          'transform md:transform-none',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
