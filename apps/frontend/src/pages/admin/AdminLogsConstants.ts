import type { BadgeProps } from '@/components/ui/badge';

export const ACTION_KEYS: Record<string, string> = {
  view: 'view',
  create: 'create',
  update: 'update',
  delete: 'delete',
  reveal: 'reveal',
  download: 'download',
  login: 'login',
  logout: 'logout',
  failed_login: 'failed_login',
  failed_vault_unlock: 'failed_vault_unlock',
  other: 'other',
  purge: 'purge',
  shared_reveal: 'shared_reveal',
  copy: 'copy',
};

export const ACTION_VARIANTS: Record<string, BadgeProps['variant']> = {
  login: 'success',
  create: 'success',
  update: 'info',
  delete: 'destructive',
  failed_login: 'destructive',
  failed_vault_unlock: 'destructive',
  purge: 'destructive',
  reveal: 'warning',
  download: 'warning',
  shared_reveal: 'warning',
  copy: 'default',
};
