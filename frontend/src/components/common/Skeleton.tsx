import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Componente base de Skeleton para loading states.
 * Usa animacao de pulse para indicar carregamento.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton para cards de estatisticas (StatCard).
 */
export function SkeletonStatCard() {
  return (
    <div className="rounded-lg border bg-card p-lg">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
      <Skeleton className="mt-md h-8 w-32" />
      <Skeleton className="mt-sm h-3 w-20" />
    </div>
  );
}

/**
 * Skeleton para linhas de tabela.
 */
export function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-md">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton para tabela completa.
 */
export function SkeletonTable({
  rows = 5,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div
      className="rounded-lg border bg-card"
      role="status"
      aria-label="Carregando tabela"
    >
      {/* Header */}
      <div className="border-b p-md">
        <div className="flex gap-md">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      {/* Rows */}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-md p-md">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton para cards de listagem.
 */
export function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-md">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-sm">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

/**
 * Skeleton para lista de cards.
 */
export function SkeletonCardList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-md" role="status" aria-label="Carregando lista">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton para formulario.
 */
export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-md" role="status" aria-label="Carregando formulario">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-sm">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="mt-lg h-10 w-32" />
    </div>
  );
}

/**
 * Skeleton para dashboard com stats e graficos.
 */
export function SkeletonDashboard() {
  return (
    <div className="space-y-lg" role="status" aria-label="Carregando dashboard">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-md md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-lg">
          <Skeleton className="mb-md h-6 w-32" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="rounded-lg border bg-card p-lg">
          <Skeleton className="mb-md h-6 w-32" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton para pagina de listagem padrao.
 */
export function SkeletonPage() {
  return (
    <div className="space-y-lg" role="status" aria-label="Carregando pagina">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      {/* Filters */}
      <div className="flex gap-md">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      {/* Table */}
      <SkeletonTable rows={8} columns={6} />
    </div>
  );
}

export default Skeleton;
