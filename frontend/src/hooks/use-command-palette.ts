import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  getAllCommands,
  searchCommands,
  groupCommandsBySection,
  type Command,
  type CommandSection,
} from '@/config/commands';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/auth-store';

interface UseCommandPaletteReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  query: string;
  setQuery: (query: string) => void;
  filteredCommands: Command[];
  groupedCommands: Record<CommandSection, Command[]>;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  executeCommand: (command: Command) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Hook para gerenciar o Command Palette.
 *
 * Fornece estado, busca e navegação por teclado.
 *
 * @example
 * ```tsx
 * function CommandPalette() {
 *   const {
 *     isOpen,
 *     open,
 *     close,
 *     query,
 *     setQuery,
 *     filteredCommands,
 *     selectedIndex,
 *     executeCommand,
 *     handleKeyDown,
 *   } = useCommandPalette();
 *
 *   return (
 *     <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
 *       ...
 *     </Dialog>
 *   );
 * }
 * ```
 */
export function useCommandPalette(): UseCommandPaletteReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQueryState] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { isDark, toggle: toggleTheme } = useTheme();

  // Obtém todos os comandos com ações dinâmicas
  const allCommands = getAllCommands(logout, toggleTheme, isDark);

  // Filtra comandos baseado na query
  const filteredCommands = searchCommands(allCommands, query);

  // Agrupa comandos por seção
  const groupedCommands = groupCommandsBySection(filteredCommands);

  // Wrapper para setQuery que também reseta o índice
  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
    setSelectedIndex(0);
  }, []);

  // Callback de fechamento que também reseta o estado
  const close = useCallback(() => {
    setIsOpen(false);
    setQueryState('');
    setSelectedIndex(0);
  }, []);

  // Listener global para Ctrl+K / Cmd+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K ou Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const executeCommand = useCallback(
    (command: Command) => {
      if (command.action) {
        command.action();
      } else if (command.href) {
        void navigate(command.href);
      }
      close();
    },
    [navigate, close]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const maxIndex = filteredCommands.length - 1;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
          break;

        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;

        case 'Escape':
          e.preventDefault();
          close();
          break;
      }
    },
    [filteredCommands, selectedIndex, executeCommand, close]
  );

  return {
    isOpen,
    open,
    close,
    toggle,
    query,
    setQuery,
    filteredCommands,
    groupedCommands,
    selectedIndex,
    setSelectedIndex,
    executeCommand,
    handleKeyDown,
  };
}

export default useCommandPalette;
