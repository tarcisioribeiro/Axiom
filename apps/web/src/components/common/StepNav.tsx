import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StepNavProps {
  onBack: () => void;
  onNext: () => void;
  /** Primeira etapa: Voltar desabilitado. */
  isFirst: boolean;
  /** Última etapa: Próximo desabilitado (a ação final fica no rodapé). */
  isLast: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Navegação entre etapas de um modal (padrão do formulário de treino): Voltar à
 * esquerda e Próximo à direita, no corpo; Cancelar e a ação ficam no rodapé.
 */
export function StepNav({
  onBack,
  onNext,
  isFirst,
  isLast,
  disabled = false,
  className,
}: StepNavProps) {
  const { t } = useTranslation();
  return (
    <div className={cn('gap-sm flex items-center justify-between', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isFirst}
        onClick={onBack}
      >
        <ChevronLeft className="h-4 w-4" />
        {t('common.actions.back')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isLast}
        onClick={onNext}
      >
        <ChevronRight className="h-4 w-4" />
        {t('common.actions.next')}
      </Button>
    </div>
  );
}
