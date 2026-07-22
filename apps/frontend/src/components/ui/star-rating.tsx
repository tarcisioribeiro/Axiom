import { Star } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

interface StarRatingProps {
  value?: number | null;
  onChange?: (value: number | null) => void;
  max?: number;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export function StarRating({
  value = null,
  onChange,
  max = 5,
  disabled = false,
  size = 'md',
  className,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const handleClick = (rating: number) => {
    if (disabled) return;
    // Se clicar na mesma estrela, limpa a avaliação
    if (value === rating) {
      onChange?.(null);
    } else {
      onChange?.(rating);
    }
  };

  const displayValue = hoverValue ?? value ?? 0;

  return (
    <div
      className={cn('flex gap-xs', className)}
      onMouseLeave={() => !disabled && setHoverValue(null)}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((rating) => (
        <button
          key={rating}
          type="button"
          disabled={disabled}
          onClick={() => handleClick(rating)}
          onMouseEnter={() => !disabled && setHoverValue(rating)}
          aria-label={`${rating} estrela${rating > 1 ? 's' : ''}`}
          className={cn(
            'rounded-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
            disabled
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer hover:scale-110'
          )}
        >
          <Star
            className={cn(
              sizeClasses[size],
              'transition-colors duration-150',
              rating <= displayValue
                ? 'fill-star text-star'
                : 'fill-transparent hover:text-star/50'
            )}
            aria-hidden="true"
          />
        </button>
      ))}
      {value !== null && !disabled && (
        <button
          type="button"
          onClick={() => onChange?.(null)}
          className="ml-sm text-xs transition-colors hover:text-destructive"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
