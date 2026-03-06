import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Users, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { MemberForm } from '@/components/members/MemberForm';
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
import { useToast } from '@/hooks/use-toast';
import { membersService } from '@/services/members-service';
import type { Member, MemberFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function Members() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
        title: t('common.messages.loadError'),
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
          title: t('pages.members.updated'),
          description: t('pages.members.updatedDesc'),
        });
      } else {
        await membersService.create(data);
        toast({
          title: t('pages.members.created'),
          description: t('pages.members.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.members.deleteTitle'),
      description: t('pages.members.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await membersService.delete(id);
      toast({
        title: t('pages.members.deleted'),
        description: t('pages.members.deletedDesc'),
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
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
        title={t('pages.members.title')}
        icon={<Users />}
        action={{
          label: t('pages.members.newBtn'),
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
          message={t('pages.members.emptyState')}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="custom-scrollbar overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    {t('pages.members.columns.name')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    {t('pages.members.columns.document')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    {t('pages.members.columns.phone')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    {t('pages.members.columns.role')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    {t('pages.members.columns.createdAt')}
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">
                    {t('common.table.actions')}
                  </th>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/members/${member.id}/report`)}
                          aria-label={t('pages.members.viewReport')}
                          title={t('pages.members.viewReport')}
                        >
                          <BarChart3 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedMember(member);
                            setIsDialogOpen(true);
                          }}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(member.id)}
                          aria-label="Excluir"
                        >
                          <Trash2
                            className="h-4 w-4 text-destructive"
                            aria-hidden="true"
                          />
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
              {selectedMember
                ? t('pages.members.editTitle')
                : t('pages.members.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedMember
                ? t('pages.members.editDesc')
                : t('pages.members.newDesc')}
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
