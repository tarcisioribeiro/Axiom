import { motion, useReducedMotion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import * as React from 'react';

import { transitions } from '@/lib/animations/transitions';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  id: string;
  value: string;
  // 1 = aba à direita da anterior, -1 = à esquerda (define o lado do slide)
  direction: number;
  onValueChange: (value: string, direction?: number) => void;
}

const TabsContext = React.createContext<TabsContextValue>({
  id: '',
  value: '',
  direction: 0,
  onValueChange: () => {},
});

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
  ...props
}: TabsProps) {
  const id = React.useId();
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? '');
  const [direction, setDirection] = React.useState(0);
  const controlled = value !== undefined;
  const activeValue = controlled ? value : internalValue;

  const handleChange = React.useCallback(
    (v: string, dir = 0) => {
      setDirection(dir);
      if (!controlled) setInternalValue(v);
      onValueChange?.(v);
    },
    [controlled, onValueChange]
  );

  return (
    <TabsContext.Provider
      value={{ id, value: activeValue, direction, onValueChange: handleChange }}
    >
      <div className={cn('', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        'bg-muted text-muted-foreground inline-flex h-9 items-center justify-center rounded-lg p-1',
        className
      )}
      {...props}
    />
  )
);
TabsList.displayName = 'TabsList';

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, children, ...props }, ref) => {
    const ctx = React.useContext(TabsContext);
    const isActive = ctx.value === value;
    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        data-state={isActive ? 'active' : 'inactive'}
        onClick={(e) => {
          if (isActive) return;
          const tabs = Array.from(
            e.currentTarget.parentElement?.querySelectorAll('[role="tab"]') ?? []
          );
          const from = tabs.findIndex(
            (el) => el.getAttribute('aria-selected') === 'true'
          );
          const to = tabs.indexOf(e.currentTarget);
          ctx.onValueChange(value, from < 0 ? 0 : Math.sign(to - from));
        }}
        className={cn(
          'ring-offset-background focus-visible:ring-ring relative isolate inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50',
          isActive && 'text-foreground',
          className
        )}
        {...props}
      >
        {isActive && (
          // Pílula compartilhada entre as abas: desliza até a aba ativa
          <motion.span
            layoutId={`${ctx.id}-tab-indicator`}
            className="bg-background absolute inset-0 -z-10 rounded-md shadow"
          />
        )}
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

// Transição leve ao trocar de aba — usada pelo TabsContent e por abas feitas à mão
// (envolva o conteúdo com `<TabTransition key={activeTab}>`).
const TabTransition = React.forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(
  (props, ref) => {
    const reduced = useReducedMotion();
    return (
      <motion.div
        ref={ref}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.normal}
        {...props}
      />
    );
  }
);
TabTransition.displayName = 'TabTransition';

interface TabsContentProps extends HTMLMotionProps<'div'> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const ctx = React.useContext(TabsContext);
    const reduced = useReducedMotion();
    if (ctx.value !== value) return null;
    return (
      <TabTransition
        key={value}
        ref={ref}
        {...(!reduced &&
          ctx.direction !== 0 && {
            initial: { opacity: 0, x: 24 * ctx.direction },
            animate: { opacity: 1, x: 0 },
          })}
        role="tabpanel"
        data-state="active"
        className={cn(
          'ring-offset-background focus-visible:ring-ring mt-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          className
        )}
        {...props}
      >
        {children}
      </TabTransition>
    );
  }
);
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsContent, TabsList, TabsTrigger, TabTransition };
