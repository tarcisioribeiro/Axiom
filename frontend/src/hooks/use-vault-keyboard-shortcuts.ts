import { useState, useEffect, useCallback } from 'react';

import { vaultConfigService } from '@/services/security-vault-service';

interface UseVaultKeyboardShortcutsResult {
  showShortcuts: boolean;
  setShowShortcuts: (value: boolean) => void;
}

export function useVaultKeyboardShortcuts(
  onLocked?: () => Promise<void>
): UseVaultKeyboardShortcutsResult {
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const tagName = target.tagName.toUpperCase();
      if (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Cmd+L / Ctrl+L lock vault
      if ((event.metaKey || event.ctrlKey) && event.key === 'l') {
        event.preventDefault();
        void vaultConfigService.lock().then(() => {
          if (onLocked) {
            return onLocked();
          }
        });
        return;
      }

      // ? toggle shortcuts panel
      if (event.key === '?') {
        event.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
    },
    [onLocked]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return { showShortcuts, setShowShortcuts };
}
