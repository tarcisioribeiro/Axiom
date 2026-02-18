import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useCommandPalette } from '@/hooks/use-command-palette';
import { sectionLabels, type Command, type CommandSection } from '@/config/commands';
import { Search, Command as CommandIcon } from 'lucide-react';
import { VisuallyHidden } from '@/components/ui/visually-hidden';

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
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
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
            'w-5 h-5 flex-shrink-0',
            isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{command.title}</div>
          {command.description && (
            <div
              className={cn(
                'text-xs truncate',
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
              'hidden sm:inline-flex px-1.5 py-0.5 text-xs font-mono rounded',
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

  const renderSection = (section: CommandSection, commands: Command[], startIndex: number) => {
    if (commands.length === 0) return null;

    return (
      <div key={section} className="py-2">
        <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {sectionLabels[section]}
        </div>
        <div className="space-y-1">
          {commands.map((command, i) =>
            renderCommandItem(command, startIndex + i)
          )}
        </div>
      </div>
    );
  };

  // Calcula índices de início para cada seção
  const sectionStartIndices: Record<CommandSection, number> = {
    navigation: 0,
    actions: groupedCommands.navigation.length,
    settings:
      groupedCommands.navigation.length + groupedCommands.actions.length,
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="sm:max-w-xl p-0 gap-0 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <VisuallyHidden>
          <DialogTitle>Command Palette</DialogTitle>
        </VisuallyHidden>

        {/* Header com campo de busca */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Buscar comandos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-auto text-base"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-muted text-muted-foreground rounded">
            <CommandIcon className="w-3 h-3" />K
          </kbd>
        </div>

        {/* Lista de comandos */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2"
          role="listbox"
          aria-label="Comandos disponíveis"
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
                className="py-12 text-center text-muted-foreground"
              >
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nenhum comando encontrado</p>
                <p className="text-sm">Tente buscar por outra palavra-chave</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer com dicas de atalho */}
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/50 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background rounded border">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-background rounded border">↓</kbd>
              <span>navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background rounded border">Enter</kbd>
              <span>selecionar</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-background rounded border">Esc</kbd>
            <span>fechar</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CommandPalette;
