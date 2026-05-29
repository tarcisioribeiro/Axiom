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
import { NavLink, Outlet, useLocation } from 'react-router-dom';

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
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-border bg-card">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-border px-lg py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-foreground">Axiom</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('layout.adminPanel')}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-xs p-3">
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
                  'flex items-center gap-3 rounded-lg px-3 py-sm text-sm font-medium transition-colors',
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
        <div className="border-t border-border p-3">
          <div className="mb-sm flex items-center gap-3 rounded-lg px-3 py-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {user?.username?.charAt(0).toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {user?.username}
              </p>
              <p className="text-xs text-muted-foreground">{t('layout.superuser')}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-sm text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            {t('layout.logout')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center gap-sm border-b border-border bg-card px-lg">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {NAV_ITEMS.find((n) =>
              n.exact
                ? location.pathname === n.href
                : location.pathname.startsWith(n.href)
            )?.label ?? 'Admin'}
          </span>
        </header>

        <main className="flex-1 overflow-auto p-lg">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
