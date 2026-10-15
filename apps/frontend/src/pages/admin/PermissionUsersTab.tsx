import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ShieldCheck, User, UserCheck, Users, UserX } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { SearchInput } from '@/components/common/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/utils';
import { adminService } from '@/services/admin-service';
import type { PermissionUser, ScreenCatalogModule } from '@/types';

import { UserPermissionsDialog } from './UserPermissionsDialog';

// Mesma chave do UserPermissionsDialog (invalidação após salvar)
const USERS_KEY = ['admin', 'permissions', 'users'];

export function PermissionUsersTab({ catalog }: { catalog: ScreenCatalogModule[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showConfirm } = useAlertDialog();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<PermissionUser>();
  const deferredSearch = useDeferredValue(search);
  const totalScreens = catalog.reduce((n, m) => n + m.screens.length, 0);

  const { data: users = [], isLoading } = useQuery({
    queryKey: [...USERS_KEY, 'list', deferredSearch],
    queryFn: () => adminService.getPermissionUsers(deferredSearch),
  });
  const filtered = users.filter(
    (u) => statusFilter === 'all' || (statusFilter === 'active') === u.is_active
  );

  const toggle = useMutation({
    mutationFn: (u: PermissionUser) => adminService.setUserActive(u.id, !u.is_active),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: USERS_KEY }),
    onError: (error) =>
      toast({
        title: getErrorMessage(error, t('pages.adminPermissions.saveError')),
        variant: 'destructive',
      }),
  });

  const onToggle = async (u: PermissionUser) => {
    if (u.is_active) {
      const confirmed = await showConfirm({
        title: t('pages.adminPermissions.deactivateTitle'),
        description: t('pages.adminPermissions.deactivateConfirm', {
          name: u.username,
        }),
        confirmText: t('pages.adminPermissions.deactivate'),
        variant: 'destructive',
        icon: UserX,
      });
      if (!confirmed) return;
    }
    toggle.mutate(u);
  };

  const columns: Column<PermissionUser>[] = [
    {
      key: 'username',
      label: t('pages.adminPermissions.columns.username'),
      render: (u) => <span className="font-medium">{u.username}</span>,
    },
    {
      key: 'name',
      label: t('pages.adminPermissions.columns.name'),
      render: (u) => u.name || '—',
    },
    {
      key: 'email',
      label: t('pages.adminPermissions.columns.email'),
      render: (u) => u.email || '—',
    },
    {
      key: 'is_active',
      label: t('pages.adminPermissions.columns.status'),
      render: (u) => (
        <Badge variant={u.is_active ? 'default' : 'secondary'}>
          {u.is_active
            ? t('pages.adminPermissions.active')
            : t('pages.adminPermissions.inactive')}
        </Badge>
      ),
    },
    {
      key: 'screen_count',
      label: t('pages.adminPermissions.columns.screens'),
      className: 'whitespace-nowrap',
      render: (u) =>
        t('pages.adminPermissions.screenCount', {
          count: u.screen_count,
          total: totalScreens,
        }),
    },
  ];

  // Mesmo espaçamento do PageContainer, que não alcança o conteúdo da aba
  return (
    <div className="space-y-lg">
      <FilterBar
        hasActiveFilters={!!search || statusFilter !== 'all'}
        onClear={() => {
          setSearch('');
          setStatusFilter('all');
        }}
      >
        <FilterField label={t('common.filterLabels.user')} icon={User}>
          <SearchInput
            placeholder={t('pages.adminPermissions.searchPlaceholder')}
            value={search}
            onValueChange={setSearch}
          />
        </FilterField>
        <FilterField
          label={t('pages.adminPermissions.columns.status')}
          icon={CheckCircle2}
        >
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label={t('pages.adminPermissions.columns.status')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('pages.adminPermissions.allStatuses')}
              </SelectItem>
              <SelectItem value="active">
                {t('pages.adminPermissions.activePlural')}
              </SelectItem>
              <SelectItem value="inactive">
                {t('pages.adminPermissions.inactivePlural')}
              </SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(u) => u.id}
        isLoading={isLoading}
        emptyState={{
          icon: <Users className="text-muted-foreground h-12 w-12" />,
          title: t('pages.adminPermissions.empty'),
        }}
        actions={(u) => (
          <div className="gap-sm flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditing(u)}
              aria-label={t('pages.adminPermissions.edit')}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void onToggle(u)}
              aria-label={
                u.is_active
                  ? t('pages.adminPermissions.deactivate')
                  : t('pages.adminPermissions.activate')
              }
            >
              {u.is_active ? (
                <UserX className="text-destructive h-4 w-4" aria-hidden="true" />
              ) : (
                <UserCheck className="text-success h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        )}
      />

      <UserPermissionsDialog
        user={editing}
        catalog={catalog}
        onClose={() => setEditing(undefined)}
      />
    </div>
  );
}
