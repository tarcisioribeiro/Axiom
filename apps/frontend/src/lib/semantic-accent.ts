/**
 * Cor semântica de destaque compartilhada entre Badge, CurrencyInput e
 * StatusToggle. Antes cada um definia sua própria forma (Badge: variant com
 * 7 opções incl. secondary/outline; CurrencyInput: accentColor com 3;
 * StatusToggle: string livre por chamador) — um mesmo conceito com três
 * APIs incompatíveis. Este é o conjunto comum aos três.
 */
export type SemanticAccent = 'default' | 'success' | 'warning' | 'info' | 'destructive';

/** Classes para o estado "ativo" de um toggle pill (StatusToggle), por accentColor. */
export const SEMANTIC_ACCENT_ACTIVE_CLASS: Record<SemanticAccent, string> = {
  default: 'bg-background text-foreground shadow-sm',
  success: 'bg-success/15 text-success shadow-sm',
  warning: 'bg-warning/15 text-warning shadow-sm',
  info: 'bg-info/15 text-info shadow-sm',
  destructive: 'bg-destructive/15 text-destructive shadow-sm',
};

/** Classes de borda/ring para inputs com prefixo colorido (CurrencyInput). */
export const SEMANTIC_ACCENT_INPUT_CLASS: Record<SemanticAccent, string> = {
  default: '',
  success: 'border-success/40 focus-visible:ring-success/30',
  warning: 'border-warning/40 focus-visible:ring-warning/30',
  info: 'border-info/40 focus-visible:ring-info/30',
  destructive: 'border-destructive/40 focus-visible:ring-destructive/30',
};

/** Cor de texto do prefixo/ícone associada a cada accentColor. */
export const SEMANTIC_ACCENT_TEXT_CLASS: Record<SemanticAccent, string> = {
  default: 'text-muted-foreground',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
  destructive: 'text-destructive',
};
