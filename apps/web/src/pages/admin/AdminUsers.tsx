import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, UserCheck, UserCog, UserPlus, UserX, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AccountFields } from '@/components/auth/AccountFields';
import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { toast } from '@/hooks/use-toast';
import { toAccountPayload, type AccountFormData } from '@/lib/account-form';
import { notifyFormErrors } from '@/lib/form-errors';
import { formatDate } from '@/lib/formatters';
import { getErrorMessage } from '@/lib/utils';
import { adminService } from '@/services/admin-service';
import type { StaffUser } from '@/types';

const STAFF_KEY = ['admin', 'staff'];

function StaffFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<AccountFormData>();

  const create = useMutation({
    mutationFn: (data: AccountFormData) =>
      adminService.createStaff(toAccountPayload(data)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_KEY });
      // O primeiro staff ativo abre o cadastro público
      void queryClient.invalidateQueries({ queryKey: ['registration-status'] });
      toast({ title: t('pages.adminUsers.created') });
      form.reset();
      onOpenChange(false);
    },
    onError: (error) =>
      toast({
        title: getErrorMessage(error, t('pages.adminUsers.saveError')),
        variant: 'destructive',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle mode="create">{t('pages.adminUsers.newStaff')}</DialogTitle>
          <DialogDescription>{t('pages.adminUsers.newStaff')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((data) => create.mutate(data), notifyFormErrors)}
          className="space-y-md"
          noValidate
        >
          <AccountFields form={form} disabled={create.isPending} />
          <div className="dialog-footer gap-sm pt-md flex justify-end border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              <X className="h-4 w-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" loading={create.isPending}>
              {!create.isPending && <Save className="h-4 w-4" />}
              {t('common.actions.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsers() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showConfirm } = useAlertDialog();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: STAFF_KEY,
    queryFn: () => adminService.getStaff(),
  });

  const toggle = useMutation({
    mutationFn: (user: StaffUser) =>
      adminService.setStaffActive(user.id, !user.is_active),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_KEY });
      void queryClient.invalidateQueries({ queryKey: ['registration-status'] });
    },
    onError: (error) =>
      toast({
        title: getErrorMessage(error, t('pages.adminUsers.saveError')),
        variant: 'destructive',
      }),
  });

  const onToggle = async (user: StaffUser) => {
    if (user.is_active) {
      const confirmed = await showConfirm({
        title: t('pages.adminUsers.deactivateTitle'),
        description: t('pages.adminUsers.deactivateConfirm', { name: user.username }),
        confirmText: t('pages.adminUsers.deactivate'),
        variant: 'destructive',
        icon: UserX,
      });
      if (!confirmed) return;
    }
    toggle.mutate(user);
  };

  const columns: Column<StaffUser>[] = [
    {
      key: 'username',
      label: t('pages.adminUsers.columns.username'),
      render: (u) => <span className="font-medium">{u.username}</span>,
    },
    {
      key: 'name',
      label: t('pages.adminUsers.columns.name'),
      render: (u) => u.name || '—',
    },
    {
      key: 'email',
      label: t('pages.adminUsers.columns.email'),
      render: (u) => u.email,
    },
    {
      key: 'is_active',
      label: t('pages.adminUsers.columns.status'),
      render: (u) => (
        <Badge variant={u.is_active ? 'default' : 'secondary'}>
          {u.is_active ? t('pages.adminUsers.active') : t('pages.adminUsers.inactive')}
        </Badge>
      ),
    },
    {
      key: 'date_joined',
      label: t('pages.adminUsers.columns.createdAt'),
      className: 'whitespace-nowrap',
      render: (u) => formatDate(new Date(u.date_joined)),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.adminUsers.title')}
        icon={<UserCog />}
        actions={
          <Button onClick={() => setIsFormOpen(true)}>
            <UserPlus />
            {t('pages.adminUsers.newStaff')}
          </Button>
        }
      />

      <DataTable
        data={staff}
        columns={columns}
        keyExtractor={(u) => u.id}
        isLoading={isLoading}
        emptyState={{
          icon: <UserCog className="text-muted-foreground h-12 w-12" />,
          title: t('pages.adminUsers.empty'),
        }}
        actions={(u) => (
          <div className="flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void onToggle(u)}
              aria-label={
                u.is_active
                  ? t('pages.adminUsers.deactivate')
                  : t('pages.adminUsers.activate')
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

      <StaffFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} />
    </PageContainer>
  );
}
