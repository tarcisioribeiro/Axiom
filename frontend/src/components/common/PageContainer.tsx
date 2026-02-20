import { cn } from '@/lib/utils';
import { AnimatedPage } from './AnimatedPage';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * PageContainer - Container padrão para páginas com centralização e animação
 *
 * Aplica o padrão visual do Dashboard:
 * - container: largura máxima responsiva
 * - mx-auto: centralização horizontal
 * - px-4: padding horizontal
 * - py-8: padding vertical
 * - space-y-6: espaçamento entre elementos filhos
 */
export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className,
}) => {
  return (
    <AnimatedPage className={cn('space-y-6 px-4 py-8', className)}>
      {children}
    </AnimatedPage>
  );
};
