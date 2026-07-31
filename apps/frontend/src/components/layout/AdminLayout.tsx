import {
  Activity,
  LayoutDashboard,
  Link2,
  LogOut,
  Settings,
  ScrollText,
  Shield,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

export const AdminLayout = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const { t } = useTranslation();

  const NAV_ITEMS = [
    {
      href: '/admin',
      label: t('layout.adminNav.overview'),
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: '/admin/config',
      label: t('layout.adminNav.config'),
      icon: Settings,
      exact: false,
    },
    {
      href: '/admin/integrations',
      label: t('layout.adminNav.integrations'),
      icon: Link2,
      exact: false,
    },
    {
      href: '/admin/logs',
      label: t('layout.adminNav.logs'),
      icon: ScrollText,
      exact: false,
    },
  ];

  return (
    <div className="bg-background flex h-screen">
      {/* Sidebar */}
      <aside className="border-border bg-card flex w-64 flex-shrink-0 flex-col border-r">
        {/* Logo */}
        <div className="border-border px-lg flex items-center gap-3 border-b py-5">
          <div className="bg-primary flex h-9 w-9 items-center justify-center rounded-lg">
            <Shield className="text-primary-foreground h-5 w-5" />
          </div>
          <div>
            <p className="text-foreground text-sm leading-none font-semibold">Axiom</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {t('layout.adminPanel')}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="space-y-xs flex-1 p-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact
              ? location.pathname === href
              : location.pathname.startsWith(href) && href !== '/admin';
            const isExactAdmin = href === '/admin' && location.pathname === '/admin';
            const active = isExactAdmin || (!exact && isActive);

            return (
              <NavLink
                key={href}
                to={href}
                end={exact}
                className={cn(
                  'py-sm flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-border border-t p-3">
          <div className="mb-sm py-sm flex items-center gap-3 rounded-lg px-3">
            <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
              {user?.username?.charAt(0).toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-medium">
                {user?.username}
              </p>
              <p className="text-muted-foreground text-xs">{t('layout.superuser')}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="py-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t('layout.logout')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="gap-sm border-border bg-card px-lg flex h-14 items-center border-b">
          <Activity className="text-primary h-4 w-4" />
          <span className="text-foreground text-sm font-medium">
            {NAV_ITEMS.find((n) =>
              n.exact
                ? location.pathname === n.href
                : location.pathname.startsWith(n.href)
            )?.label ?? 'Admin'}
          </span>
        </header>

        <main className="p-lg flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
