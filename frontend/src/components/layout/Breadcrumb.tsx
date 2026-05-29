import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  const { breadcrumbs } = useBreadcrumb();

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center', className)}>
      {/* Versão desktop - todos os items */}
      <ol className="hidden items-center gap-xs text-sm md:flex">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const Icon = item.icon;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-xs">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              )}
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  className="flex items-center gap-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={cn(
                    'flex items-center gap-sm',
                    isLast ? 'font-medium text-foreground' : 'text-muted-foreground'
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
      <div className="flex items-center gap-sm text-sm md:hidden">
        {breadcrumbs.length > 1 && (
          <>
            <Link
              to={breadcrumbs[breadcrumbs.length - 2].href ?? '/'}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`Voltar para ${breadcrumbs[breadcrumbs.length - 2].label}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="font-medium text-foreground">
              {breadcrumbs[breadcrumbs.length - 1].label}
            </span>
          </>
        )}
      </div>
    </nav>
  );
}

export default Breadcrumb;
