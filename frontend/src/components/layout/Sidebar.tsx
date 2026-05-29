/* eslint-disable max-lines */
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, X, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useEffect, useReducer, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { Tooltip } from '@/components/ui/tooltip';
import {
  navItems,
  navModules,
  getAllModuleItems,
  isPathActive,
  type NavModule,
  type NavSubItem,
} from '@/config/nav-config';
import { useSidebar, useIsMobile } from '@/hooks/use-sidebar';
import { useThemeAssets } from '@/hooks/use-theme-assets';
import { APP_ENV, APP_VERSION, IS_PRODUCTION } from '@/lib/app-info';
import { cn } from '@/lib/utils';
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
  const { hasPermission, user } = useAuthStore();
  const { isOpen, isCollapsed, close, toggleCollapsed } = useSidebar();
  const isMobile = useIsMobile();
  const { icon } = useThemeAssets();
  const { t } = useTranslation();
  const navRef = useRef<HTMLElement>(null);

  const [expanded, dispatch] = useReducer(accordionReducer, {
    module: null,
    subModule: null,
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

    return (
      <div key={module.id} className="space-y-xs">
        {/* Module header button */}
        {isCollapsed ? (
          <Tooltip content={t(module.titleKey)} side="right">
            <button
              onClick={() => handleModuleClick(module.id)}
              aria-label={t(module.titleKey)}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-150',
                hasActiveItem
                  ? 'font-medium text-primary'
                  : 'sidebar-text hover:bg-accent/60 hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={() => handleModuleClick(module.id)}
            aria-expanded={isExpanded}
            aria-controls={`module-${module.id}`}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-md py-sm text-sm transition-all duration-200',
              hasActiveItem
                ? 'font-medium text-primary'
                : 'sidebar-text hover:bg-accent/60 hover:text-accent-foreground'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">{t(module.titleKey)}</span>
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
                          'flex w-full items-center gap-3 rounded-lg px-md py-sm text-sm transition-all duration-150',
                          isSubExpanded
                            ? 'bg-primary/10 font-medium text-primary'
                            : hasSubActiveItem
                              ? 'bg-accent/50 font-medium text-accent-foreground'
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
    <div className="flex flex-col items-center gap-xs py-xs">
      {filteredNavItems.map((item) => (
        <NavLink key={item.href} item={item} isCollapsed={true} />
      ))}
      <div className="my-xs w-8 border-t border-border/40" />
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
        <Link
          to="/"
          className="flex items-center gap-sm"
          aria-label="Axiom — página inicial"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-border/50">
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
                className="gradient-primary bg-clip-text text-lg font-bold tracking-tight text-transparent"
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
            className="rounded-lg p-sm transition-colors hover:bg-accent"
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

            <div className="my-sm border-t border-border/40" />

            {navModules.map((module) => renderModule(module))}
          </div>
        )}
      </nav>

      {/* User profile */}
      {user && (
        <div
          className={cn(
            'mt-sm border-t border-border/40 pt-sm',
            isCollapsed && !isMobile ? 'flex justify-center' : ''
          )}
        >
          {isCollapsed && !isMobile ? (
            <Tooltip
              content={`${user.first_name} ${user.last_name}`.trim() || user.username}
              side="right"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-border/50">
                {user.profile_photo ? (
                  <img
                    src={user.profile_photo}
                    alt=""
                    className="h-full w-full object-cover"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="text-xs font-semibold text-primary">
                    {(user.first_name?.[0] ?? user.username?.[0] ?? '?').toUpperCase()}
                  </span>
                )}
              </div>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-border/50">
                {user.profile_photo ? (
                  <img
                    src={user.profile_photo}
                    alt=""
                    className="h-full w-full object-cover"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="text-xs font-semibold text-primary">
                    {(user.first_name?.[0] ?? user.username?.[0] ?? '?').toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {`${user.first_name} ${user.last_name}`.trim() || user.username}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.username}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Version info (desktop expanded only) */}
      {!isMobile && !isCollapsed && (
        <div className="mt-sm flex items-center justify-center gap-xs">
          <span className="select-none font-mono text-[10px] text-muted-foreground/40">
            v{APP_VERSION}
          </span>
          {!IS_PRODUCTION && (
            <span
              className={cn(
                'select-none rounded px-xs py-px text-[9px] font-bold uppercase tracking-wide',
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
            'mt-sm border-t border-border/40 pt-3',
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
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {isCollapsed ? (
                <PanelLeft className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </Tooltip>
          {!isCollapsed && (
            <p className="mt-xs text-center text-xs text-muted-foreground/60">⌘B</p>
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
            className="fixed inset-0 z-sidebar-overlay bg-black/50 md:hidden"
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
          'fixed inset-y-0 left-0 z-sidebar md:sticky md:top-0',
          'flex h-screen flex-col border-r border-border/50 bg-card',
          // desktop width transition
          'transition-[width,padding] duration-300 ease-in-out',
          isCollapsed && !isMobile ? 'w-[3.75rem] p-sm' : 'w-72 p-md',
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
