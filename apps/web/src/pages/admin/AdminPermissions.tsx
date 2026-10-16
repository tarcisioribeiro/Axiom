import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, SlidersHorizontal, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PERMISSIONS_PATH } from '@/config/nav-config';
import { useTabRoute } from '@/hooks/use-tab-route';
import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/utils';
import { adminService } from '@/services/admin-service';
import type { ScreenGrants } from '@/types';

import { PermissionMatrix } from './PermissionMatrix';
import { PermissionUsersTab } from './PermissionUsersTab';

const TABS = ['users', 'defaults'] as const;
const DEFAULTS_KEY = ['admin', 'permissions', 'defaults'];

const useCatalog = () =>
  useQuery({
    queryKey: ['admin', 'permissions', 'screens'],
    queryFn: () => adminService.getScreenCatalog(),
    staleTime: Infinity,
  });

export default function AdminPermissions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useTabRoute(PERMISSIONS_PATH, TABS, 'users');
  const { data: catalog = [] } = useCatalog();
  // Rascunho local só depois de editar; até lá, mostra o que está salvo
  const [edited, setEdited] = useState<ScreenGrants | null>(null);
  const { data: defaults } = useQuery({
    queryKey: DEFAULTS_KEY,
    queryFn: () => adminService.getScreenDefaults(),
  });
  const defaultsDraft = edited ?? defaults?.screens ?? {};

  const saveDefaults = useMutation({
    mutationFn: () => adminService.saveScreenDefaults(defaultsDraft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DEFAULTS_KEY });
      setEdited(null);
      toast({ title: t('pages.adminPermissions.saved') });
    },
    onError: (error) =>
      toast({
        title: getErrorMessage(error, t('pages.adminPermissions.saveError')),
        variant: 'destructive',
      }),
  });

  return (
    <PageContainer>
      <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof TABS)[number])}>
        <PageHeader
          title={
            tab === 'users'
              ? t('pages.adminPermissions.tabs.users')
              : t('pages.adminPermissions.tabs.defaults')
          }
          icon={tab === 'users' ? <Users /> : <SlidersHorizontal />}
          actions={
            tab === 'defaults' && (
              <Button
                onClick={() => saveDefaults.mutate()}
                loading={saveDefaults.isPending}
              >
                {!saveDefaults.isPending && <Save />}
                {t('common.actions.save')}
              </Button>
            )
          }
        />
        <TabsList className="mt-lg mb-lg w-full">
          <TabsTrigger value="users" className="gap-xs flex-1">
            <Users className="h-4 w-4" />
            {t('pages.adminPermissions.tabs.users')}
          </TabsTrigger>
          <TabsTrigger value="defaults" className="gap-xs flex-1">
            <SlidersHorizontal className="h-4 w-4" />
            {t('pages.adminPermissions.tabs.defaults')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-0">
          <PermissionUsersTab catalog={catalog} />
        </TabsContent>
        <TabsContent value="defaults" className="mt-0">
          <PermissionMatrix
            catalog={catalog}
            value={defaultsDraft}
            onChange={setEdited}
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
