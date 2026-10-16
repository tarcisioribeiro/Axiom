import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/utils';
import { adminService } from '@/services/admin-service';
import type { PermissionUser, ScreenCatalogModule, ScreenGrants } from '@/types';

import { PermissionMatrix } from './PermissionMatrix';

const USERS_KEY = ['admin', 'permissions', 'users'];

function UserPermissionsForm({
  user,
  catalog,
  initial,
  onClose,
}: {
  user: PermissionUser;
  catalog: ScreenCatalogModule[];
  initial: ScreenGrants;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ScreenGrants>(initial);

  const save = useMutation({
    mutationFn: () => adminService.saveUserScreens(user.id, draft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      toast({ title: t('pages.adminPermissions.saved') });
      onClose();
    },
    onError: (error) =>
      toast({
        title: getErrorMessage(error, t('pages.adminPermissions.saveError')),
        variant: 'destructive',
      }),
  });

  return (
    <>
      <PermissionMatrix catalog={catalog} value={draft} onChange={setDraft} inDialog />
      <div className="dialog-footer gap-sm pt-md flex justify-end border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={save.isPending}
        >
          <X className="h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        <Button onClick={() => save.mutate()} loading={save.isPending}>
          {!save.isPending && <Save className="h-4 w-4" />}
          {t('common.actions.save')}
        </Button>
      </div>
    </>
  );
}

export function UserPermissionsDialog({
  user,
  catalog,
  onClose,
}: {
  user: PermissionUser | undefined;
  catalog: ScreenCatalogModule[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: [...USERS_KEY, user?.id],
    queryFn: () => adminService.getUserScreens(user!.id),
    enabled: !!user,
    staleTime: 0,
  });
  const ready = !!user && data?.id === user.id;

  // Abre só com os dados carregados, para o modal não crescer (§7)
  return (
    <Dialog open={ready} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle icon={ShieldCheck}>
            {t('pages.adminPermissions.userTitle', { name: user?.username })}
          </DialogTitle>
          <DialogDescription>
            {t('pages.adminPermissions.userTitle', { name: user?.username })}
          </DialogDescription>
        </DialogHeader>
        {ready && (
          <UserPermissionsForm
            key={user.id}
            user={user}
            catalog={catalog}
            initial={data.screens}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
