import { ChevronDownIcon as ChevronDown } from '@heroicons/react/24/solid';
import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

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
            'text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-border p-md border-t">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
