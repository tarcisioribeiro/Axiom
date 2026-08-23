import { cn } from '@/lib/utils';

interface KcalBarProps {
  value: number;
  max: number;
  color: string;
}

export function KcalBar({ value, max, color }: KcalBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
      <div
        className={cn(
          'h-full w-full origin-left rounded-full transition-transform duration-500',
          color
        )}
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}
