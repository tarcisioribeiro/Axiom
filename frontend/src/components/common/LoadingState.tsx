/**
 * LoadingState Component
 *
 * Componente reutilizável para estados de carregamento.
 * Suporta dois modos: spinner tradicional ou skeleton para melhor perceived performance.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import {
  SkeletonTable,
  SkeletonList,
  SkeletonStatsGrid,
} from '@/components/ui/skeleton-variants';

type SkeletonVariant = 'table' | 'list' | 'stats' | 'custom';

interface LoadingStateProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  message?: string;
  /**
   * Usar skeleton em vez de spinner para melhor perceived performance.
   * - 'table': skeleton de tabela
   * - 'list': skeleton de lista
   * - 'stats': skeleton de cards de estatísticas
   * - 'custom': usar children como skeleton customizado
   */
  skeleton?: SkeletonVariant;
  /**
   * Configuração do skeleton (rows para table, items para list/stats)
   */
  skeletonConfig?: {
    rows?: number;
    columns?: number;
    items?: number;
  };
  /**
   * Skeleton customizado quando skeleton='custom'
   */
  children?: React.ReactNode;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  size = 'md',
  fullScreen = false,
  message,
  skeleton,
  skeletonConfig,
  children,
}) => {
  const sizeClasses = {
    sm: 'h-32',
    md: 'h-64',
    lg: 'h-96',
  };

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  // Skeleton mode
  if (skeleton) {
    const ariaProps = {
      'aria-busy': true,
      'aria-label': message || 'Carregando conteudo',
    };

    switch (skeleton) {
      case 'table':
        return (
          <div {...ariaProps}>
            <SkeletonTable
              rows={skeletonConfig?.rows ?? 5}
              columns={skeletonConfig?.columns ?? 5}
            />
          </div>
        );
      case 'list':
        return (
          <div {...ariaProps}>
            <SkeletonList items={skeletonConfig?.items ?? 5} />
          </div>
        );
      case 'stats':
        return (
          <div {...ariaProps}>
            <SkeletonStatsGrid items={skeletonConfig?.items ?? 4} />
          </div>
        );
      case 'custom':
        return <div {...ariaProps}>{children}</div>;
    }
  }

  // Spinner mode (default)
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${
        fullScreen ? 'h-screen' : sizeClasses[size]
      }`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2
        className={`${iconSizes[size]} animate-spin text-primary`}
        aria-hidden="true"
      />
      {message && <p className="text-sm">{message}</p>}
      <span className="sr-only">{message || 'Carregando...'}</span>
    </div>
  );
};
