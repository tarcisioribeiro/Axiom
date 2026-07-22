import { useState, useCallback } from 'react';

interface UseSuccessAnimationOptions {
  /** Variante visual: minimal (só check), standard (check + círculo), celebration (com partículas) */
  variant?: 'minimal' | 'standard' | 'celebration';
  /** Tamanho do componente */
  size?: 'sm' | 'md' | 'lg';
  /** Callback quando animação termina */
  onComplete?: () => void;
  /** Classe CSS adicional */
  className?: string;
  /** Duração antes de chamar onComplete (ms) */
  duration?: number;
}

/**
 * Hook para usar animação de sucesso de forma imperativa.
 *
 * @example
 * ```tsx
 * import { SuccessAnimation } from '@/components/ui/success-animation';
 *
 * function MyComponent() {
 *   const { isShowing, showSuccess, hideSuccess, animationProps } = useSuccessAnimation({
 *     variant: 'standard',
 *     duration: 1500,
 *   });
 *
 *   const handleSave = async () => {
 *     await save();
 *     showSuccess();
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleSave}>Salvar</button>
 *       <SuccessAnimation {...animationProps} />
 *     </>
 *   );
 * }
 * ```
 */
export function useSuccessAnimation(options: UseSuccessAnimationOptions = {}) {
  const [isShowing, setIsShowing] = useState(false);

  const showSuccess = useCallback(() => {
    setIsShowing(true);
  }, []);

  const hideSuccess = useCallback(() => {
    setIsShowing(false);
  }, []);

  const handleComplete = useCallback(() => {
    hideSuccess();
    options.onComplete?.();
  }, [hideSuccess, options]);

  const animationProps = {
    show: isShowing,
    variant: options.variant,
    size: options.size,
    className: options.className,
    duration: options.duration,
    onComplete: handleComplete,
  };

  return {
    isShowing,
    showSuccess,
    hideSuccess,
    animationProps,
  };
}

export default useSuccessAnimation;
