import { Check, Moon, Palette, Sun } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DARK_THEMES,
  LIGHT_THEMES,
  type ThemeOption,
} from '@/components/common/theme-options';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDesktopThemeSync } from '@/hooks/use-desktop-theme-sync';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  /** Segue o tema do desktop (theme_switcher.sh) — só em páginas autenticadas */
  syncWithDesktop?: boolean;
}

/** Miniatura do app nas cores do tema: barra lateral + card com texto e botão */
function ThemeCard<T extends string>({
  theme,
  active,
  onSelect,
}: {
  theme: ThemeOption<T>;
  active: boolean;
  onSelect: (id: T) => void;
}) {
  const c = (v: string, alpha = 1) => `hsl(${v} / ${alpha})`;
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      aria-pressed={active}
      className={cn(
        'gap-xs p-xs flex flex-col rounded-lg border-2 text-left transition',
        active ? 'border-primary' : 'hover:border-border border-transparent'
      )}
    >
      <div
        className="flex h-16 overflow-hidden rounded-md border"
        style={{ background: c(theme.bg), borderColor: c(theme.fg, 0.15) }}
        aria-hidden="true"
      >
        <div className="w-1/4" style={{ background: c(theme.card) }} />
        <div className="p-xs flex flex-1 flex-col justify-center">
          <div
            className="p-xs gap-xs flex flex-col rounded"
            style={{ background: c(theme.card) }}
          >
            <span className="h-1 w-3/4 rounded" style={{ background: c(theme.fg) }} />
            <span
              className="h-1 w-1/2 rounded"
              style={{ background: c(theme.fg, 0.5) }}
            />
            <span
              className="h-2 w-1/3 self-end rounded"
              style={{ background: c(theme.primary) }}
            />
          </div>
        </div>
      </div>
      <span className="gap-xs flex items-center text-xs font-medium">
        <span className="flex-1 truncate">{theme.label}</span>
        {active && <Check className="text-primary h-3.5 w-3.5" aria-hidden="true" />}
      </span>
    </button>
  );
}

export function ThemeToggle({ className, syncWithDesktop = false }: ThemeToggleProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { isDark, darkVariant, lightVariant, setDarkVariant, setLightVariant } =
    useTheme();
  useDesktopThemeSync(syncWithDesktop, setDarkVariant, setLightVariant);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        tooltipSide="bottom"
        onClick={() => setOpen(true)}
        className={cn('hover:bg-secondary transition', className)}
        aria-label={t('layout.themes.title')}
      >
        {isDark ? (
          <Sun
            className="text-warning duration-normal h-5 w-5 transition-transform hover:rotate-12"
            aria-hidden="true"
          />
        ) : (
          <Moon
            className="text-primary duration-normal h-5 w-5 transition-transform hover:rotate-12"
            aria-hidden="true"
          />
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle icon={Palette}>{t('layout.themes.title')}</DialogTitle>
            <DialogDescription>{t('layout.themes.description')}</DialogDescription>
          </DialogHeader>

          <section className="space-y-sm">
            <h3 className="text-muted-foreground text-sm font-medium">
              {t('layout.themes.light')}
            </h3>
            <div className="gap-sm grid grid-cols-2 sm:grid-cols-4">
              {LIGHT_THEMES.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  active={!isDark && lightVariant === theme.id}
                  onSelect={setLightVariant}
                />
              ))}
            </div>
          </section>

          <section className="space-y-sm">
            <h3 className="text-muted-foreground text-sm font-medium">
              {t('layout.themes.dark')}
            </h3>
            <div className="gap-sm grid grid-cols-2 sm:grid-cols-4">
              {DARK_THEMES.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  active={isDark && darkVariant === theme.id}
                  onSelect={setDarkVariant}
                />
              ))}
            </div>
          </section>

          <DialogCloseFooter />
        </DialogContent>
      </Dialog>
    </>
  );
}
