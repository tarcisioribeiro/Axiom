import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Users, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { membersService } from '@/services/members-service';
import { permissionsService, type Permission } from '@/services/permissions-service';
import { getErrorMessage } from '@/utils/error-utils';
import type { Member } from '@/types';

// Mapeamento de apps para nomes amigáveis
const APP_DISPLAY_NAMES: { [key: string]: string } = {
  accounts: 'Controle Financeiro - Contas',
  expenses: 'Controle Financeiro - Despesas',
  revenues: 'Controle Financeiro - Receitas',
  credit_cards: 'Controle Financeiro - Cartões',
  loans: 'Controle Financeiro - Empréstimos',
  transfers: 'Controle Financeiro - Transferências',
  security: 'Segurança',
  library: 'Leitura',
};

interface AppPermissions {
  name: string;
  code: string;
  permissions: Permission[];
}

export default function Permissions() {
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
          name: APP_DISPLAY_NAMES[appCode] || appCode,
          code: appCode,
          permissions: permissions,
        })
      );

      setAvailableApps(apps);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar dados',
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
        title: 'Aviso',
        description:
          'Este membro não possui usuário associado e não pode ter permissões.',
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
        title: 'Erro ao carregar permissões',
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
        title: 'Erro',
        description:
          'Este membro não possui usuário associado e não pode ter permissões.',
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
        title: 'Permissões atualizadas',
        description: `Permissões do membro ${selectedMember.name} foram atualizadas com sucesso.`,
      });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao salvar permissões',
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
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Shield className="h-8 w-8" />
          Gerenciamento de Permissões
        </h1>
        <p className="mt-2">
          Controle o acesso dos membros aos diferentes módulos do MindLedger
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Lista de Membros */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Membros
            </CardTitle>
            <CardDescription>
              Selecione um membro para gerenciar suas permissões
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {members.map((member) => (
                <Button
                  key={member.id}
                  variant={selectedMember?.id === member.id ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => loadMemberPermissions(member)}
                >
                  <div className="flex w-full items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{member.name}</div>
                      <div className="text-xs">
                        {[
                          member.is_creditor && 'Credor',
                          member.is_benefited && 'Beneficiário',
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
              {members.length === 0 && (
                <p className="py-4 text-center text-sm">Nenhum membro cadastrado</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Permissões por App */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedMember
                ? `Permissões de ${selectedMember.name}`
                : 'Selecione um membro'}
            </CardTitle>
            <CardDescription>
              {selectedMember
                ? 'Marque ou desmarque as permissões que este membro terá acesso'
                : 'Escolha um membro da lista para gerenciar suas permissões'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedMember ? (
              isLoadingPermissions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  {availableApps.map((app) => (
                    <div key={app.code} className="space-y-3">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <h3 className="text-lg font-semibold">{app.name}</h3>
                        <Badge variant="secondary">
                          {app.permissions.length} permissões
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
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
                                <Check className="ml-2 h-4 w-4" />
                              ) : (
                                <X className="ml-2 h-4 w-4 opacity-30" />
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end gap-2 border-t pt-4">
                    <Button variant="outline" onClick={() => setSelectedMember(null)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={savePermissions}
                      disabled={isSaving || !selectedMember.user}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Salvar Permissões
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Shield className="mb-4 h-16 w-16 opacity-20" />
                <p className="text-lg">Selecione um membro para começar</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legenda */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Como funciona</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
            <div className="flex items-start gap-2">
              <div className="mt-1.5 h-2 w-2 rounded-full bg-success" />
              <div>
                <p className="font-medium">Permissões Ativas</p>
                <p>Permissões marcadas estão ativas para o membro</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-1.5 h-2 w-2 rounded-full bg-muted-foreground" />
              <div>
                <p className="font-medium">Permissões Inativas</p>
                <p>Permissões desmarcadas não estão disponíveis</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-1.5 h-2 w-2 rounded-full bg-info" />
              <div>
                <p className="font-medium">Granularidade</p>
                <p>Controle fino de visualização e adição</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
