import { Command as CommandIcon, CornerDownLeft, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LIST_PAGE_SIZE, PageSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCommandPalette } from '@/hooks/use-command-palette';
import { cn } from '@/lib/utils';

/**
 * Command Palette global, aberta pelo header ou por Win+K / Cmd+K.
 *
 * Modal de ação (§2.4): lista paginada em 5 (sem rolagem, §2.5); ↑/↓ trocam
 * de página ao passar do último/primeiro item da página.
 */
export function CommandPalette() {
  const { t } = useTranslation();
  const {
    isOpen,
    close,
    query,
    setQuery,
    filteredCommands,
    selectedIndex,
    setSelectedIndex,
    executeCommand,
    handleKeyDown,
  } = useCommandPalette();

  const totalPages = Math.max(1, Math.ceil(filteredCommands.length / LIST_PAGE_SIZE));
  const pageStart = Math.floor(selectedIndex / LIST_PAGE_SIZE) * LIST_PAGE_SIZE;
  const pageCommands = filteredCommands.slice(pageStart, pageStart + LIST_PAGE_SIZE);
  const selected = filteredCommands[selectedIndex];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle icon={CommandIcon}>
            {t('layout.commandPalette.title')}
          </DialogTitle>
          <DialogDescription>
            {t('layout.commandPalette.description')}
          </DialogDescription>
        </DialogHeader>

        <SearchInput
          value={query}
          onValueChange={setQuery}
          onKeyDown={handleKeyDown}
          placeholder={t('layout.commandPalette.placeholder')}
          className="flex-none"
        />

        {filteredCommands.length > 0 ? (
          <PageSlide
            page={pageStart / LIST_PAGE_SIZE + 1}
            totalPages={totalPages}
            onPageChange={(page) => setSelectedIndex((page - 1) * LIST_PAGE_SIZE)}
            resetKey={query}
            pinNav={false}
          >
            <div
              role="listbox"
              aria-label={t('layout.commandPalette.ariaLabel')}
              className="space-y-xs"
            >
              {pageCommands.map((command, i) => {
                const index = pageStart + i;
                const isSelected = index === selectedIndex;
                const Icon = command.icon;
                const showSection =
                  i === 0 || pageCommands[i - 1].section !== command.section;
                return (
                  <div key={command.id}>
                    {showSection && (
                      <div className="px-sm pb-xs pt-sm text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                        {t(`layout.commandPalette.sections.${command.section}`)}
                      </div>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => executeCommand(command)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        'gap-sm px-sm py-sm flex w-full items-center rounded-lg text-left transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-5 w-5 shrink-0',
                          isSelected
                            ? 'text-primary-foreground'
                            : 'text-muted-foreground'
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {command.title}
                      </span>
                      {command.shortcut && (
                        <kbd
                          className={cn(
                            'px-sm hidden rounded py-0.5 text-xs sm:inline-flex',
                            isSelected
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {command.shortcut}
                        </kbd>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </PageSlide>
        ) : (
          <EmptyState icon={<Search />} title={t('layout.commandPalette.noResults')} />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            <X className="h-4 w-4" />
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={() => selected && executeCommand(selected)}
            disabled={!selected}
          >
            <CornerDownLeft className="h-4 w-4" />
            {t('layout.commandPalette.execute')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CommandPalette;
