import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MemberForm } from '@/components/members/MemberForm';
import { membersService } from '@/services/members-service';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getErrorMessage } from '@/utils/error-utils';
import type { Member, MemberFormData } from '@/types';
import { format } from 'date-fns';
import { PageContainer } from '@/components/common/PageContainer';

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await membersService.getAll();
      setMembers(data);
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

  const handleSubmit = async (data: MemberFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedMember) {
        await membersService.update(selectedMember.id, data);
        toast({
          title: 'Membro atualizado',
          description: 'O membro foi atualizado com sucesso.',
        });
      } else {
        await membersService.create(data);
        toast({
          title: 'Membro criado',
          description: 'O membro foi criado com sucesso.',
        });
      }
      setIsDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao salvar',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir membro',
      description:
        'Tem certeza que deseja excluir este membro? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await membersService.delete(id);
      toast({
        title: 'Membro excluído',
        description: 'O membro foi excluído com sucesso.',
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Membros"
        icon={<Users />}
        action={{
          label: 'Novo Membro',
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setSelectedMember(undefined);
            setIsDialogOpen(true);
          },
        }}
      />

      {members.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12 text-muted-foreground" />}
          message='Nenhum membro cadastrado. Clique em "Novo Membro" para começar.'
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="custom-scrollbar overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Nome</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Documento
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Telefone
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Papel</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Criado em
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.map((member) => (
                  <tr key={member.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="font-medium">{member.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">{member.document}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">{member.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {member.is_creditor && (
                          <Badge variant="secondary">Credor</Badge>
                        )}
                        {member.is_benefited && (
                          <Badge variant="outline">Beneficiário</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {format(new Date(member.created_at), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedMember(member); setIsDialogOpen(true); }} aria-label="Editar">
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(member.id)} aria-label="Excluir">
                          <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedMember ? 'Editar Membro' : 'Novo Membro'}
            </DialogTitle>
            <DialogDescription>
              {selectedMember
                ? 'Atualize as informações do membro'
                : 'Adicione um novo membro ao sistema'}
            </DialogDescription>
          </DialogHeader>
          <MemberForm
            member={selectedMember}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
