import { cn } from '@/lib/utils';

import { AnimatedPage } from './AnimatedPage';
import { EmailVerificationBanner } from './EmailVerificationBanner';

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
 * - px-md: padding horizontal (1rem)
 * - py-xl: padding vertical (2rem)
 * - space-y-lg: espaçamento entre elementos filhos (1.5rem)
 */
export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className,
}) => {
  return (
    <AnimatedPage className={cn('space-y-lg px-sm py-md md:px-lg md:py-xl', className)}>
      <EmailVerificationBanner />
      {children}
    </AnimatedPage>
  );
};
