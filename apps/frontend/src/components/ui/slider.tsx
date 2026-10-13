import { cn } from '@/lib/utils';

type SliderTone = 'primary' | 'success' | 'warning' | 'destructive';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Faixa bloqueada no começo do trilho (ex.: limite já utilizado); o valor não desce dela. */
  floor?: number;
  tone?: SliderTone;
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-valuetext'?: string;
  className?: string;
}

// Classes completas por tom (o Tailwind só gera classes escritas por extenso).
const FILL: Record<SliderTone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};
const THUMB: Record<SliderTone, string> = {
  primary: '[&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary',
  success: '[&::-webkit-slider-thumb]:bg-success [&::-moz-range-thumb]:bg-success',
  warning: '[&::-webkit-slider-thumb]:bg-warning [&::-moz-range-thumb]:bg-warning',
  destructive:
    '[&::-webkit-slider-thumb]:bg-destructive [&::-moz-range-thumb]:bg-destructive',
};

const THUMB_SIZE = 20; // px — h-5/w-5 abaixo

/**
 * Range nativo (teclado e leitor de tela de graça) com trilho, preenchimento
 * e polegar nos tokens do app.
 */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  floor,
  tone = 'primary',
  id,
  disabled = false,
  'aria-label': ariaLabel,
  'aria-valuetext': ariaValueText,
  className,
}: SliderProps) {
  const pctOf = (v: number) => (max > min ? ((v - min) / (max - min)) * 100 : 0);
  // Posição do centro do polegar: o range nativo encolhe o percurso pela largura dele.
  const at = (v: number) => {
    const p = pctOf(v);
    return `calc(${p}% + ${(0.5 - p / 100) * THUMB_SIZE}px)`;
  };

  return (
    <div
      className={cn(
        'relative flex h-5 w-full items-center',
        disabled && 'opacity-50',
        className
      )}
    >
      <div className="bg-muted absolute inset-x-0 h-2 rounded-full" />
      <div
        className={cn('absolute left-0 h-2 rounded-full opacity-80', FILL[tone])}
        style={{ width: at(value) }}
      />
      {floor !== undefined && floor > min && (
        <div
          className="bg-destructive/70 absolute left-0 h-2 rounded-full"
          style={{ width: at(floor) }}
        />
      )}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-valuetext={ariaValueText}
        onChange={(e) => {
          const v = Number(e.target.value);
          // `step` pode não alcançar um máximo fora do múltiplo — encaixa no topo.
          const snapped = v + step > max ? max : v;
          onChange(floor !== undefined ? Math.max(floor, snapped) : snapped);
        }}
        className={cn(
          'relative w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none disabled:cursor-not-allowed',
          '[&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent',
          '[&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:transition-transform',
          '[&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:transition-transform',
          '[&:active::-moz-range-thumb]:scale-110 [&:active::-webkit-slider-thumb]:scale-110',
          '[&:focus-visible::-webkit-slider-thumb]:ring-ring [&:focus-visible::-webkit-slider-thumb]:ring-offset-background [&:focus-visible::-webkit-slider-thumb]:ring-2 [&:focus-visible::-webkit-slider-thumb]:ring-offset-2',
          '[&:focus-visible::-moz-range-thumb]:ring-ring [&:focus-visible::-moz-range-thumb]:ring-offset-background [&:focus-visible::-moz-range-thumb]:ring-2 [&:focus-visible::-moz-range-thumb]:ring-offset-2',
          THUMB[tone]
        )}
      />
    </div>
  );
}
