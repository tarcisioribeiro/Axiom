import {
  ChevronLeftIcon as ChevronLeft,
  ChevronRightIcon as ChevronRight,
} from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useBreadcrumb } from '@/hooks/use-breadcrumb';
import { cn } from '@/lib/utils';

interface BreadcrumbProps {
  className?: string;
}

/**
 * Componente Breadcrumb para navegação hierárquica.
 *
 * Exibe a hierarquia de navegação atual baseada na rota.
 * Em mobile mostra apenas o item atual, em desktop mostra todos.
 *
 * @example
 * ```tsx
 * <Breadcrumb className="my-md" />
 * ```
 */
export function Breadcrumb({ className }: BreadcrumbProps) {
  const { t } = useTranslation();
  const { breadcrumbs } = useBreadcrumb();

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center', className)}>
      {/* Versão desktop - todos os items */}
      <ol className="gap-xs hidden items-center text-sm md:flex">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const Icon = item.icon;

          return (
            <li key={`${item.label}-${index}`} className="gap-xs flex items-center">
              {index > 0 && (
                <ChevronRight className="text-muted-foreground h-4 w-4 flex-shrink-0" />
              )}
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  className="gap-sm text-muted-foreground hover:text-foreground flex items-center transition-colors"
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={cn(
                    'gap-sm flex items-center',
                    isLast ? 'text-foreground font-medium' : 'text-muted-foreground'
                  )}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Versão mobile - apenas item atual */}
      <div className="gap-sm flex items-center text-sm md:hidden">
        {breadcrumbs.length > 1 && (
          <>
            <Link
              to={breadcrumbs[breadcrumbs.length - 2].href ?? '/'}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t('common.navigation.backTo', {
                label: breadcrumbs[breadcrumbs.length - 2].label,
              })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="text-foreground font-medium">
              {breadcrumbs[breadcrumbs.length - 1].label}
            </span>
          </>
        )}
      </div>
    </nav>
  );
}

export default Breadcrumb;
