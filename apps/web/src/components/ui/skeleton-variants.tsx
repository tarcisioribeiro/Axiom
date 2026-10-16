import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Skeleton para linhas de tabela.
 */
function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-md">
          <Skeleton className="h-4 w-full max-w-[120px]" />
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
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn('w-full overflow-auto', className)}>
      <table className="w-full" role="presentation">
        <thead>
          <tr className="bg-muted/50 border-b">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="p-md text-left" aria-hidden="true">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Skeleton para lista de itens (despesas, receitas, etc).
 */
function SkeletonListItem({ className }: { className?: string }) {
  return (
    <div className={cn('gap-md p-md flex items-center border-b', className)}>
      <Skeleton className="h-10 w-10 flex-shrink-0 rounded-full" />
      <div className="space-y-sm flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  );
}

/**
 * Skeleton para lista completa.
 */
export function SkeletonList({
  items = 5,
  className,
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div className={cn('divide-y', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton para stats/metricas do dashboard.
 */
function SkeletonStat({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="px-lg py-lg pt-lg">
        <div className="flex items-center justify-between">
          <div className="space-y-sm">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
        <Skeleton className="mt-md h-3 w-20" />
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton para grid de stats do dashboard.
 */
export function SkeletonStatsGrid({
  items = 4,
  className,
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div className={cn('gap-md grid md:grid-cols-2 lg:grid-cols-4', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  );
}
