import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command as CommandIcon } from 'lucide-react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { sectionLabels, type Command, type CommandSection } from '@/config/commands';
import { useCommandPalette } from '@/hooks/use-command-palette';
import { cn } from '@/lib/utils';

/**
 * Command Palette global acessível via Ctrl+K / Cmd+K.
 *
 * Permite navegação rápida e execução de ações via teclado.
 *
 * @example
 * ```tsx
 * // No Layout.tsx
 * import { CommandPalette } from '@/components/layout/CommandPalette';
 *
 * export const Layout = () => (
 *   <div>
 *     <Sidebar />
 *     <Header />
 *     <main>...</main>
 *     <CommandPalette />
 *   </div>
 * );
 * ```
 */
export function CommandPalette() {
  const { t } = useTranslation();
  const {
    isOpen,
    close,
    query,
    setQuery,
    filteredCommands,
    groupedCommands,
    selectedIndex,
    setSelectedIndex,
    executeCommand,
    handleKeyDown,
  } = useCommandPalette();

  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Focus no input quando abre
  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll para item selecionado
  React.useEffect(() => {
    if (listRef.current && filteredCommands.length > 0) {
      const selectedElement = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, filteredCommands.length]);

  const renderCommandItem = (command: Command, index: number) => {
    const Icon = command.icon;
    const isSelected = index === selectedIndex;

    return (
      <motion.button
        key={command.id}
        data-index={index}
        onClick={() => executeCommand(command)}
        onMouseEnter={() => setSelectedIndex(index)}
        className={cn(
          'py-sm flex w-full items-center gap-3 rounded-lg px-3 text-left transition-colors',
          isSelected
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-accent hover:text-accent-foreground'
        )}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
      >
        <Icon
          className={cn(
            'h-5 w-5 flex-shrink-0',
            isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{command.title}</div>
          {command.description && (
            <div
              className={cn(
                'truncate text-xs',
                isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
              )}
            >
              {command.description}
            </div>
          )}
        </div>
        {command.shortcut && (
          <kbd
            className={cn(
              'px-sm hidden rounded py-0.5 font-mono text-xs sm:inline-flex',
              isSelected
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {command.shortcut}
          </kbd>
        )}
      </motion.button>
    );
  };

  const renderSection = (
    section: CommandSection,
    commands: Command[],
    startIndex: number
  ) => {
    if (commands.length === 0) return null;

    return (
      <div key={section} className="py-sm">
        <div className="py-sm text-muted-foreground px-3 text-xs font-semibold tracking-wider uppercase">
          {sectionLabels[section]}
        </div>
        <div className="space-y-xs">
          {commands.map((command, i) => renderCommandItem(command, startIndex + i))}
        </div>
      </div>
    );
  };

  // Calcula índices de início para cada seção
  const sectionStartIndices: Record<CommandSection, number> = {
    navigation: 0,
    actions: groupedCommands.navigation.length,
    settings: groupedCommands.navigation.length + groupedCommands.actions.length,
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-xl"
        onKeyDown={handleKeyDown}
      >
        <VisuallyHidden>
          <DialogTitle>Command Palette</DialogTitle>
        </VisuallyHidden>

        {/* Header com campo de busca */}
        <div className="px-md flex items-center gap-3 border-b py-3">
          <Search className="text-muted-foreground h-5 w-5 flex-shrink-0" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={t('layout.commandPalette.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-auto border-0 px-0 text-base shadow-none focus-visible:ring-0"
          />
          <kbd className="gap-xs bg-muted px-sm py-xs text-muted-foreground hidden items-center rounded font-mono text-xs sm:inline-flex">
            <CommandIcon className="h-3 w-3" />K
          </kbd>
        </div>

        {/* Lista de comandos */}
        <div
          ref={listRef}
          className="custom-scrollbar p-sm max-h-[60vh] overflow-y-auto"
          role="listbox"
          aria-label={t('layout.commandPalette.ariaLabel')}
        >
          <AnimatePresence mode="wait">
            {filteredCommands.length > 0 ? (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {renderSection(
                  'navigation',
                  groupedCommands.navigation,
                  sectionStartIndices.navigation
                )}
                {renderSection(
                  'actions',
                  groupedCommands.actions,
                  sectionStartIndices.actions
                )}
                {renderSection(
                  'settings',
                  groupedCommands.settings,
                  sectionStartIndices.settings
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-muted-foreground py-12 text-center"
              >
                <Search className="mx-auto mb-3 h-12 w-12 opacity-50" />
                <p className="font-medium">{t('layout.commandPalette.noResults')}</p>
                <p className="text-sm">{t('layout.commandPalette.noResultsHint')}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer com dicas de atalho */}
        <div className="bg-muted/50 px-md py-sm text-muted-foreground flex items-center justify-between border-t text-xs">
          <div className="gap-md flex items-center">
            <span className="gap-xs flex items-center">
              <kbd className="bg-background px-sm rounded border py-0.5">↑</kbd>
              <kbd className="bg-background px-sm rounded border py-0.5">↓</kbd>
              <span>{t('layout.commandPalette.navigate')}</span>
            </span>
            <span className="gap-xs flex items-center">
              <kbd className="bg-background px-sm rounded border py-0.5">Enter</kbd>
              <span>{t('layout.commandPalette.select')}</span>
            </span>
          </div>
          <span className="gap-xs flex items-center">
            <kbd className="bg-background px-sm rounded border py-0.5">Esc</kbd>
            <span>{t('layout.commandPalette.close')}</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CommandPalette;
