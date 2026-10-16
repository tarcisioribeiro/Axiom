import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { transitions } from '@/lib/animations/transitions';
import { cn } from '@/lib/utils';

/**
 * Expandir/recolher padrão (altura + fade) para toggles tipo "Ver detalhes".
 * Uso: `<Collapse open={expanded}>…</Collapse>` no lugar de `{expanded && …}`.
 */
function Collapse({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          // overflow só fica hidden durante a animação — aberto, não corta
          // focus ring/sombra do conteúdo
          initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
          animate={{
            height: 'auto',
            opacity: 1,
            transitionEnd: { overflow: 'visible' },
          }}
          exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
          transition={transitions.normal}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  children,
  className,
}: CollapsibleSectionProps) {
  return (
    <div className={cn('border-border bg-card rounded-lg border', className)}>
      <button
        type="button"
        onClick={onToggle}
        className="gap-sm px-md py-sm hover:bg-muted/40 flex w-full items-center justify-between text-left transition-colors"
        aria-expanded={open}
      >
        <div className="gap-sm flex items-center">
          {icon && (
            <span className="text-primary flex h-6 w-6 items-center justify-center">
              {icon}
            </span>
          )}
          <span className="text-foreground text-sm font-semibold">{title}</span>
        </div>
        <ChevronDown
          className={cn(
            'text-muted-foreground duration-normal h-4 w-4 shrink-0 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      <Collapse open={open}>
        <div className="border-border p-md border-t">{children}</div>
      </Collapse>
    </div>
  );
}
