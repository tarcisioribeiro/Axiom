import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { isDark, toggle: toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn('transition-all hover:bg-secondary', className)}
      aria-label={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
    >
      {isDark ? (
        <Sun
          className="h-5 w-5 text-warning transition-transform duration-200 hover:rotate-12"
          aria-hidden="true"
        />
      ) : (
        <Moon
          className="h-5 w-5 text-primary transition-transform duration-200 hover:rotate-12"
          aria-hidden="true"
        />
      )}
    </Button>
  );
}
