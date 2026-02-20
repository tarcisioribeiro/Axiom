import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Check, X, Loader2 } from 'lucide-react';

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  description?: string;
  children: React.ReactElement<React.HTMLProps<HTMLElement>>;
  className?: string;
  /** Mostra ícone de validação quando campo é válido (sem erro e foi tocado) */
  isValid?: boolean;
  /** Estado de validação: idle, validating, valid, invalid */
  validationState?: ValidationState;
  /** Esconde o ícone de feedback de validação */
  hideValidationIcon?: boolean;
}

/**
 * FormField wrapper que adiciona acessibilidade e feedback visual automaticamente.
 *
 * Features:
 * - aria-describedby linkando campo a mensagem de erro/descricao
 * - aria-invalid quando ha erro
 * - aria-required quando campo e obrigatorio
 * - IDs consistentes para label, erro e descricao
 * - Ícone de feedback de validação (check verde / X vermelho / spinner)
 * - Classes de validação no input para estilização
 *
 * Uso:
 * ```tsx
 * <FormField
 *   id="email"
 *   label="Email"
 *   error={errors.email?.message}
 *   isValid={!errors.email && touchedFields.email}
 *   required
 * >
 *   <Input {...register('email')} onBlur={() => trigger('email')} />
 * </FormField>
 * ```
 */
export function FormField({
  id,
  label,
  error,
  required,
  description,
  children,
  className,
  isValid,
  validationState,
  hideValidationIcon = false,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;

  // Determina estado de validação
  const computedState: ValidationState = validationState
    ? validationState
    : error
      ? 'invalid'
      : isValid
        ? 'valid'
        : 'idle';

  // Constroi aria-describedby baseado nas props presentes
  const describedByParts: string[] = [];
  if (error) describedByParts.push(errorId);
  if (description) describedByParts.push(descriptionId);
  const ariaDescribedBy =
    describedByParts.length > 0 ? describedByParts.join(' ') : undefined;

  // Classes de validação para o input
  const validationClasses = cn({
    'ring-2 ring-destructive/50 border-destructive focus-visible:ring-destructive':
      computedState === 'invalid',
    'ring-2 ring-success/50 border-success focus-visible:ring-success':
      computedState === 'valid',
  });

  // Clona o children (input) adicionando props de acessibilidade e classes
  const enhancedChild = React.cloneElement(children, {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': ariaDescribedBy,
    'aria-required': required ? true : undefined,
    className: cn(children.props.className, validationClasses),
  });

  // Renderiza ícone de feedback
  const renderValidationIcon = () => {
    if (hideValidationIcon || computedState === 'idle') return null;

    switch (computedState) {
      case 'validating':
        return (
          <Loader2
            className="h-4 w-4 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        );
      case 'valid':
        return <Check className="h-4 w-4 text-success" aria-hidden="true" />;
      case 'invalid':
        return <X className="h-4 w-4 text-destructive" aria-hidden="true" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>
          {label}
          {required && (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </Label>
        {renderValidationIcon()}
      </div>

      {enhancedChild}

      {description && !error && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          className="animate-in slide-in-from-top-1 text-sm text-destructive duration-200"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default FormField;
