import {
  CheckCircle2,
  Dumbbell,
  LayoutDashboard,
  ListTodo,
  NotebookPen,
  UtensilsCrossed,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  group?: string;
}

export function PlanningLayout() {
  const { t } = useTranslation();
  const location = useLocation();

  const navItems: NavItem[] = [
    {
      label: t('planningLayout.dashboard'),
      to: '/planning/dashboard',
      icon: LayoutDashboard,
      group: t('planningLayout.groupOverview'),
    },
    {
      label: t('planningLayout.checklist'),
      to: '/planning/daily-checklist',
      icon: CheckCircle2,
      group: t('planningLayout.groupDaily'),
    },
    {
      label: t('planningLayout.reflections'),
      to: '/planning/reflections',
      icon: NotebookPen,
      group: t('planningLayout.groupDaily'),
    },
    {
      label: t('planningLayout.tasksGoals'),
      to: '/planning/tasks-goals',
      icon: ListTodo,
      group: t('planningLayout.groupHabits'),
    },
    {
      label: t('planningLayout.workout'),
      to: '/planning/workout',
      icon: Dumbbell,
      group: t('planningLayout.groupHealth'),
    },
    {
      label: t('planningLayout.nutrition'),
      to: '/planning/nutrition',
      icon: UtensilsCrossed,
      group: t('planningLayout.groupHealth'),
    },
  ];

  const groups = navItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    const g = item.group ?? '';
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  const isActive = (to: string) => {
    if (to === '/planning/tasks-goals') {
      return (
        location.pathname === '/planning/tasks-goals' ||
        location.pathname === '/planning/goals' ||
        location.pathname === '/planning/routine-tasks'
      );
    }
    return location.pathname === to;
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* Planning secondary sidebar */}
      <nav
        aria-label={t('planningLayout.navLabel')}
        className="bg-sidebar/50 w-full shrink-0 border-b lg:w-52 lg:border-b-0 lg:border-r"
      >
        <div className="p-sm">
          <p className="mb-sm px-sm py-xs text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('planningLayout.title')}
          </p>
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="mb-sm">
              {group && (
                <p className="mb-xs px-sm text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                  {group}
                </p>
              )}
              <div className="flex flex-row flex-wrap gap-xs lg:flex-col lg:gap-0">
                {items.map((item) => (
                  <NavLink
                    key={item.to + item.label}
                    to={item.to}
                    className={cn(
                      'flex items-center gap-sm rounded-md px-sm py-xs text-sm transition-colors',
                      isActive(item.to)
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Page content */}
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
