import { Star } from 'lucide-react';
import { useState } from 'react';

import { PlainButton } from '@/components/ui/plain-button';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value?: number | null;
  onChange?: (value: number | null) => void;
  max?: number;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  'aria-invalid'?: boolean;
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
  'aria-invalid': ariaInvalid,
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
      aria-invalid={ariaInvalid}
      className={cn(
        'gap-xs aria-[invalid=true]:ring-destructive/50 flex aria-[invalid=true]:rounded-md aria-[invalid=true]:ring-2',
        className
      )}
      onMouseLeave={() => !disabled && setHoverValue(null)}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((rating) => (
        <PlainButton
          key={rating}
          type="button"
          disabled={disabled}
          onClick={() => handleClick(rating)}
          onMouseEnter={() => !disabled && setHoverValue(rating)}
          aria-label={`${rating} estrela${rating > 1 ? 's' : ''}`}
          className={cn(
            'focus-visible:ring-ring duration-fast rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
            disabled
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer hover:scale-110'
          )}
        >
          <Star
            className={cn(
              sizeClasses[size],
              'duration-fast transition-colors',
              rating <= displayValue
                ? 'fill-star text-star'
                : 'hover:text-star/50 fill-transparent'
            )}
            aria-hidden="true"
          />
        </PlainButton>
      ))}
      {value !== null && !disabled && (
        <button
          type="button"
          onClick={() => onChange?.(null)}
          className="ml-sm hover:text-destructive text-xs transition-colors"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
