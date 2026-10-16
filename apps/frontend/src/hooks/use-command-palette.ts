import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import {
  getAllCommands,
  searchCommands,
  groupCommandsBySection,
  type Command,
  type CommandSection,
} from '@/config/commands';
import { useScreenAccess } from '@/hooks/use-screen-access';
import { useTheme } from '@/hooks/use-theme';
import { screenForPath } from '@/lib/screen-access';
import { useAuthStore } from '@/stores/auth-store';
import { useCommandPaletteStore } from '@/stores/command-palette-store';

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
  const { isOpen, open, close: storeClose, toggle } = useCommandPaletteStore();
  const [query, setQueryState] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { isDark, toggle: toggleTheme } = useTheme();

  // Obtém todos os comandos com ações dinâmicas
  // Comando que leva a uma tela sem acesso não aparece
  const { can } = useScreenAccess();
  const allCommands = getAllCommands(logout, toggleTheme, isDark, (id) =>
    t(`layout.commandPalette.commands.${id}`)
  ).filter((cmd) => !cmd.href || can(screenForPath(cmd.href)));

  // Filtra e agrupa por seção; a lista plana segue a ordem exibida, para o
  // índice selecionado (↑/↓/Enter) apontar para o item destacado.
  const groupedCommands = groupCommandsBySection(searchCommands(allCommands, query));
  const filteredCommands = Object.values(groupedCommands).flat();

  // Wrapper para setQuery que também reseta o índice
  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
    setSelectedIndex(0);
  }, []);

  // Callback de fechamento que também reseta o estado
  const close = useCallback(() => {
    storeClose();
    setQueryState('');
    setSelectedIndex(0);
  }, [storeClose]);

  // Listener global para Win+K / Cmd+K (Ctrl+K também) e atalhos de teclado (N D, N R, T, Q)
  useEffect(() => {
    let pendingKey = '';
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

    const isEditableTarget = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (el as HTMLElement).isContentEditable
      );
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Win+K / Cmd+K (metaKey) ou Ctrl+K — abre/fecha o palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
        pendingKey = '';
        return;
      }

      // Ignorar quando o foco está em campos de texto ou quando há modificadores
      if (isEditableTarget() || e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toUpperCase();

      // Sequências de duas teclas: N+D e N+R
      if (pendingKey === 'N' && key === 'D') {
        e.preventDefault();
        void navigate('/expenses');
        pendingKey = '';
        if (pendingTimeout) clearTimeout(pendingTimeout);
        return;
      }
      if (pendingKey === 'N' && key === 'R') {
        e.preventDefault();
        void navigate('/revenues');
        pendingKey = '';
        if (pendingTimeout) clearTimeout(pendingTimeout);
        return;
      }

      // Teclas únicas
      if (key === 'T' && !pendingKey) {
        e.preventDefault();
        toggleTheme();
        return;
      }
      if (key === 'Q' && !pendingKey) {
        e.preventDefault();
        logout();
        return;
      }

      // Registra tecla para possível sequência
      if (key === 'N') {
        pendingKey = 'N';
        if (pendingTimeout) clearTimeout(pendingTimeout);
        pendingTimeout = setTimeout(() => {
          pendingKey = '';
        }, 1000);
        return;
      }

      // Qualquer outra tecla cancela sequência pendente
      pendingKey = '';
      if (pendingTimeout) clearTimeout(pendingTimeout);
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
      if (pendingTimeout) clearTimeout(pendingTimeout);
    };
  }, [navigate, logout, toggleTheme, toggle]);

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
