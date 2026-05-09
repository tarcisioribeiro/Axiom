import { Check, Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type DarkVariant, type LightVariant, useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

interface DarkVariantOption {
  id: DarkVariant;
  label: string;
  primary: string;
  bg: string;
}

interface LightVariantOption {
  id: LightVariant;
  label: string;
  primary: string;
  bg: string;
}

const DARK_VARIANTS: DarkVariantOption[] = [
  { id: 'dracula', label: 'Dracula', primary: '#BD93F9', bg: '#282A36' },
  {
    id: 'catppuccin-mocha',
    label: 'Catppuccin Mocha',
    primary: '#CBA6F7',
    bg: '#1E1E2E',
  },
  { id: 'tokyo-night', label: 'Tokyo Night', primary: '#7AA2F7', bg: '#1A1B26' },
  { id: 'gruvbox-dark', label: 'Gruvbox Dark', primary: '#FE8019', bg: '#282828' },
  { id: 'cyberpunk', label: 'Cyberpunk', primary: '#FF00FF', bg: '#0D0D1A' },
  { id: 'flat-remix', label: 'Flat Remix', primary: '#5294E2', bg: '#383C4A' },
  { id: 'everforest', label: 'Everforest', primary: '#7FBBB3', bg: '#2D353B' },
];

const LIGHT_VARIANTS: LightVariantOption[] = [
  { id: 'alucard', label: 'Alucard', primary: '#644AC9', bg: '#FFFBEB' },
  {
    id: 'catppuccin-latte',
    label: 'Catppuccin Latte',
    primary: '#8839EF',
    bg: '#EFF1F5',
  },
  { id: 'rose-pine-dawn', label: 'Rosé Pine Dawn', primary: '#907AA9', bg: '#FAF4ED' },
  {
    id: 'everforest-light',
    label: 'Everforest Light',
    primary: '#3A94C5',
    bg: '#F3F0E4',
  },
  { id: 'gruvbox-light', label: 'Gruvbox Light', primary: '#D79921', bg: '#FBF1C7' },
  {
    id: 'solarized-light',
    label: 'Solarized Light',
    primary: '#268BD2',
    bg: '#FDF6E3',
  },
  { id: 'nord-light', label: 'Nord Light', primary: '#5E81AC', bg: '#ECEFF4' },
];

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { isDark, darkVariant, lightVariant, setDarkVariant, setLightVariant } =
    useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
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
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Modo Claro
        </DropdownMenuLabel>

        {LIGHT_VARIANTS.map((variant) => {
          const isActive = !isDark && lightVariant === variant.id;
          return (
            <DropdownMenuItem
              key={variant.id}
              onClick={() => setLightVariant(variant.id)}
              className="flex cursor-pointer items-center gap-sm"
            >
              <span
                className="h-4 w-4 flex-shrink-0 rounded-full border border-border/50"
                style={{
                  background: `linear-gradient(135deg, ${variant.bg} 50%, ${variant.primary} 50%)`,
                }}
                aria-hidden="true"
              />
              <span className="flex-1">{variant.label}</span>
              {isActive && (
                <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Modo Escuro
        </DropdownMenuLabel>

        {DARK_VARIANTS.map((variant) => {
          const isActive = isDark && darkVariant === variant.id;
          return (
            <DropdownMenuItem
              key={variant.id}
              onClick={() => setDarkVariant(variant.id)}
              className="flex cursor-pointer items-center gap-sm"
            >
              <span
                className="h-4 w-4 flex-shrink-0 rounded-full border border-border/50"
                style={{
                  background: `linear-gradient(135deg, ${variant.bg} 50%, ${variant.primary} 50%)`,
                }}
                aria-hidden="true"
              />
              <span className="flex-1">{variant.label}</span>
              {isActive && (
                <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
