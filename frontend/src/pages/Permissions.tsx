/* eslint-disable max-lines */
import { Loader2, Shield, Users, Check, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { membersService } from '@/services/members-service';
import { permissionsService, type Permission } from '@/services/permissions-service';
import type { Member } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface AppPermissions {
  name: string;
  code: string;
  permissions: Permission[];
}

export default function Permissions() {
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberPermissions, setMemberPermissions] = useState<Set<string>>(new Set());
  const [availableApps, setAvailableApps] = useState<AppPermissions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    void loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);

      // Carregar membros e permissões disponíveis em paralelo
      const [membersData, permissionsData] = await Promise.all([
        membersService.getAll(),
        permissionsService.getAvailablePermissions(),
      ]);

      setMembers(membersData);

      // Organizar permissões por app
      const apps: AppPermissions[] = Object.entries(permissionsData).map(
        ([appCode, permissions]) => ({
          name: t(`pages.permissions.apps.${appCode}`, { defaultValue: appCode }),
          code: appCode,
          permissions: permissions,
        })
      );

      setAvailableApps(apps);
    } catch (error: unknown) {
      toast({
        title: t('pages.permissions.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMemberPermissions = async (member: Member) => {
    setSelectedMember(member);
    setMemberPermissions(new Set());

    // Se o membro não tem usuário associado, não pode ter permissões
    if (!member.user) {
      toast({
        title: t('pages.permissions.noUserWarning'),
        description: t('pages.permissions.noUserDesc'),
        variant: 'default',
      });
      return;
    }

    try {
      setIsLoadingPermissions(true);
      const response = await permissionsService.getMemberPermissions(member.id);
      setMemberPermissions(new Set(response.permissions));
    } catch (error: unknown) {
      toast({
        title: t('pages.permissions.loadPermissionsError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPermissions(false);
    }
  };

  const togglePermission = (codename: string) => {
    const newPermissions = new Set(memberPermissions);
    if (newPermissions.has(codename)) {
      newPermissions.delete(codename);
    } else {
      newPermissions.add(codename);
    }
    setMemberPermissions(newPermissions);
  };

  const savePermissions = async () => {
    if (!selectedMember) return;

    if (!selectedMember.user) {
      toast({
        title: t('pages.permissions.saveErrorTitle'),
        description: t('pages.permissions.noUserDesc'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);

      const permissionCodenames = Array.from(memberPermissions);

      await permissionsService.updateMemberPermissions(
        selectedMember.id,
        permissionCodenames
      );

      // Recarregar as permissões do membro após salvar
      const response = await permissionsService.getMemberPermissions(selectedMember.id);
      setMemberPermissions(new Set(response.permissions));

      toast({
        title: t('pages.permissions.saved'),
        description: t('pages.permissions.savedDesc', { name: selectedMember.name }),
      });
    } catch (error: unknown) {
      toast({
        title: t('pages.permissions.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      <div>
        <h1 className="flex items-center gap-sm text-3xl font-bold">
          <Shield className="h-8 w-8" />
          {t('pages.permissions.title')}
        </h1>
        <p className="mt-sm">{t('pages.permissions.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-3">
        {/* Lista de Membros */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-sm">
              <Users className="h-5 w-5" />
              {t('pages.permissions.membersTitle')}
            </CardTitle>
            <CardDescription>{t('pages.permissions.membersDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-sm">
              {members.map((member) => (
                <Button
                  key={member.id}
                  variant={selectedMember?.id === member.id ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => loadMemberPermissions(member)}
                >
                  <div className="flex w-full items-center gap-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{member.name}</div>
                      <div className="text-xs">
                        {[
                          member.is_creditor && t('pages.permissions.creditor'),
                          member.is_benefited && t('pages.permissions.beneficiary'),
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
              {members.length === 0 && (
                <p className="py-md text-center text-sm">
                  {t('pages.permissions.noMembers')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Permissões por App */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedMember
                ? t('pages.permissions.permissionsOf', { name: selectedMember.name })
                : t('pages.permissions.selectMember')}
            </CardTitle>
            <CardDescription>
              {selectedMember
                ? t('pages.permissions.checkPermissions')
                : t('pages.permissions.selectMemberDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedMember ? (
              isLoadingPermissions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-lg">
                  {availableApps.map((app) => (
                    <div key={app.code} className="space-y-3">
                      <div className="flex items-center gap-sm border-b pb-sm">
                        <h3 className="text-lg font-semibold">{app.name}</h3>
                        <Badge variant="secondary">
                          {t('pages.permissions.permissionsCount', {
                            count: app.permissions.length,
                          })}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-sm md:grid-cols-2">
                        {app.permissions.map((permission) => {
                          const isActive = memberPermissions.has(permission.codename);
                          return (
                            <Button
                              key={permission.codename}
                              variant={isActive ? 'default' : 'outline'}
                              size="sm"
                              className="justify-between"
                              onClick={() => togglePermission(permission.codename)}
                              disabled={!selectedMember.user}
                            >
                              <span>{permission.name}</span>
                              {isActive ? (
                                <Check className="ml-sm h-4 w-4" />
                              ) : (
                                <X className="ml-sm h-4 w-4 opacity-30" />
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end gap-sm border-t pt-md">
                    <Button variant="outline" onClick={() => setSelectedMember(null)}>
                      {t('common.actions.cancel')}
                    </Button>
                    <Button
                      onClick={savePermissions}
                      disabled={isSaving || !selectedMember.user}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-sm h-4 w-4 animate-spin" />
                          {t('common.actions.saving')}
                        </>
                      ) : (
                        <>
                          <Check className="mr-sm h-4 w-4" />
                          {t('pages.permissions.savePermissions')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Shield className="mb-md h-16 w-16 opacity-20" />
                <p className="text-lg">{t('pages.permissions.selectMemberStart')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legenda */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('pages.permissions.howItWorks')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-md text-sm md:grid-cols-3">
            <div className="flex items-start gap-sm">
              <div className="mt-sm h-2 w-2 rounded-full bg-success" />
              <div>
                <p className="font-medium">
                  {t('pages.permissions.activePermissions')}
                </p>
                <p>{t('pages.permissions.activePermissionsDesc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-sm">
              <div className="mt-sm h-2 w-2 rounded-full bg-muted-foreground" />
              <div>
                <p className="font-medium">
                  {t('pages.permissions.inactivePermissions')}
                </p>
                <p>{t('pages.permissions.inactivePermissionsDesc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-sm">
              <div className="mt-sm h-2 w-2 rounded-full bg-info" />
              <div>
                <p className="font-medium">{t('pages.permissions.granularity')}</p>
                <p>{t('pages.permissions.granularityDesc')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
