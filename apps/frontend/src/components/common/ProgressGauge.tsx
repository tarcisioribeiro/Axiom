import { CircularProgress } from '@/components/ui/circular-progress';
import { cn } from '@/lib/utils';

interface ProgressGaugeProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  className?: string;
}

/**
 * ProgressGauge - gauge circular reutilizável para exibir progresso 0-100
 * com um rótulo primário e secundário centralizados.
 *
 * Usa `ui/circular-progress` como primitivo de desenho do anel.
 */
export function ProgressGauge({
  value,
  size = 80,
  strokeWidth = 8,
  color,
  trackColor,
  label,
  sublabel,
  className,
}: ProgressGaugeProps) {
  return (
    <CircularProgress
      value={value}
      size={size}
      strokeWidth={strokeWidth}
      color={color}
      trackColor={trackColor}
      className={cn(className)}
    >
      <div className="flex flex-col items-center justify-center leading-none">
        {label && (
          <span className="text-lg leading-none font-bold tabular-nums">{label}</span>
        )}
        {sublabel && (
          <span className="text-muted-foreground text-2xs mt-0.5">{sublabel}</span>
        )}
      </div>
    </CircularProgress>
  );
}
