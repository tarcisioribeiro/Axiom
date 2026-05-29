/* eslint-disable max-lines */
import { format } from 'date-fns';
import {
  BarChart3,
  Pencil,
  Plus,
  Trash2,
  Users,
  Banknote,
  HandCoins,
  UserCheck,
  Phone,
  Mail,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { MemberForm } from '@/components/members/MemberForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { membersService } from '@/services/members-service';
import type { Member, MemberFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const SEX_COLORS: Record<string, { bg: string; text: string }> = {
  M: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400' },
  F: { bg: 'bg-pink-500/15', text: 'text-pink-600 dark:text-pink-400' },
  O: { bg: 'bg-violet-500/15', text: 'text-violet-600 dark:text-violet-400' },
};

function MemberInitials({ name, sex }: { name: string; sex: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const colors = SEX_COLORS[sex] ?? { bg: 'bg-muted', text: 'text-muted-foreground' };
  return (
    <div
      className={cn(
        'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold',
        colors.bg,
        colors.text
      )}
    >
      {initials}
    </div>
  );
}

export default function Members() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserMemberId, setCurrentUserMemberId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [data] = await Promise.all([
        membersService.getAll(),
        membersService
          .getCurrentUserMember()
          .then((m) => setCurrentUserMemberId(m.id))
          .catch(() => setCurrentUserMemberId(null)),
      ]);
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

  const filteredMembers = useMemo(() => {
    if (!searchTerm) return members;
    const q = searchTerm.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.document.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q)
    );
  }, [members, searchTerm]);

  const creditorCount = members.filter((m) => m.is_creditor).length;
  const beneficiaryCount = members.filter((m) => m.is_benefited).length;
  const activeCount = members.filter((m) => m.active).length;

  if (isLoading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader title={t('pages.members.title')} icon={<Users />}>
        <Button
          onClick={() => {
            setSelectedMember(undefined);
            setIsDialogOpen(true);
          }}
          className="gap-sm"
        >
          <Plus className="h-4 w-4" />
          {t('pages.members.newBtn')}
        </Button>
      </PageHeader>

      <FilterBar hasActiveFilters={!!searchTerm} onClear={() => setSearchTerm('')}>
        <SearchInput
          placeholder="Buscar por nome, CPF ou telefone…"
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="w-52 sm:w-64"
        />
      </FilterBar>

      {/* Stat cards */}
      {members.length > 0 && (
        <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
          <Card className="overflow-hidden border-t-2 border-t-primary/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
              <p className="text-sm font-medium">{t('pages.members.title')}</p>
              <div className="rounded-lg bg-primary/10 p-sm ring-1 ring-primary/20">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{members.length}</div>
              <p className="mt-xs text-xs text-muted-foreground">
                {t('pages.members.stats.registeredSubtitle')}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-t-2 border-t-success/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
              <p className="text-sm font-medium">{t('pages.members.stats.active')}</p>
              <div className="rounded-lg bg-success/10 p-sm ring-1 ring-success/20">
                <UserCheck className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{activeCount}</div>
              <p className="mt-xs text-xs text-muted-foreground">
                {t('pages.members.stats.activeSubtitle')}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-t-2 border-t-blue-500/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
              <p className="text-sm font-medium">
                {t('pages.members.stats.creditors')}
              </p>
              <div className="rounded-lg bg-blue-500/10 p-sm ring-1 ring-blue-500/20">
                <Banknote className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {creditorCount}
              </div>
              <p className="mt-xs text-xs text-muted-foreground">
                {t('pages.members.stats.creditorsSubtitle')}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-t-2 border-t-emerald-500/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
              <p className="text-sm font-medium">
                {t('pages.members.stats.beneficiaries')}
              </p>
              <div className="rounded-lg bg-emerald-500/10 p-sm ring-1 ring-emerald-500/20">
                <HandCoins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {beneficiaryCount}
              </div>
              <p className="mt-xs text-xs text-muted-foreground">
                {t('pages.members.stats.beneficiariesSubtitle')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {filteredMembers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm ? t('pages.members.emptySearch') : t('pages.members.emptyState')
          }
        />
      ) : (
        <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredMembers.map((member) => {
            const isCurrentUser = currentUserMemberId === member.id;
            return (
              <Card
                key={member.id}
                className={cn(
                  'overflow-hidden transition-shadow hover:shadow-md',
                  isCurrentUser && 'ring-2 ring-primary/40',
                  !member.active && 'opacity-60'
                )}
              >
                {/* Header com avatar e nome */}
                <div className="flex items-start gap-3 bg-gradient-to-r from-muted/50 to-transparent p-md">
                  <MemberInitials name={member.name} sex={member.sex} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-sm">
                      <p className="truncate font-semibold leading-tight">
                        {member.name}
                      </p>
                      {isCurrentUser && (
                        <Badge
                          variant="secondary"
                          className="shrink-0 px-sm py-0 text-[10px]"
                        >
                          Você
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(member.created_at), 'dd/MM/yyyy')}
                    </p>
                    {/* Papéis */}
                    <div className="mt-sm flex flex-wrap gap-xs">
                      {member.is_creditor && (
                        <span className="inline-flex items-center gap-xs rounded-full bg-blue-500/10 px-sm py-0.5 text-[10px] font-semibold text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400">
                          <Banknote className="h-2.5 w-2.5" />
                          {t('pages.members.form.isCreditor')}
                        </span>
                      )}
                      {member.is_benefited && (
                        <span className="inline-flex items-center gap-xs rounded-full bg-emerald-500/10 px-sm py-0.5 text-[10px] font-semibold text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
                          <HandCoins className="h-2.5 w-2.5" />
                          {t('pages.members.form.isBenefited')}
                        </span>
                      )}
                      {!member.is_creditor && !member.is_benefited && (
                        <span className="text-[10px] text-muted-foreground">
                          {t('pages.members.noRole')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dados de contato */}
                <CardContent className="space-y-sm py-3">
                  {member.phone && (
                    <div className="flex items-center gap-sm text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span>{member.phone}</span>
                    </div>
                  )}
                  {member.email && (
                    <div className="flex items-center gap-sm text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  )}
                  {member.document && (
                    <p className="font-mono text-xs text-muted-foreground">
                      {member.document}
                    </p>
                  )}
                  {member.monthly_income && (
                    <div className="rounded bg-muted/50 px-sm py-xs text-xs">
                      <span className="text-muted-foreground">
                        {t('pages.members.stats.income')}{' '}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(parseFloat(member.monthly_income))}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between border-t pt-sm">
                    <Badge
                      variant={member.active ? 'success' : 'outline'}
                      className="text-xs"
                    >
                      {member.active
                        ? t('common.status.active')
                        : t('common.status.inactive')}
                    </Badge>
                    <div className="flex gap-xs">
                      {isCurrentUser && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navigate(`/members/${member.id}/report`)}
                          aria-label={t('pages.members.viewReport')}
                          title={t('pages.members.viewReport')}
                        >
                          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setSelectedMember(member);
                          setIsDialogOpen(true);
                        }}
                        aria-label={t('common.actions.edit')}
                        title={t('common.actions.edit')}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDelete(member.id)}
                        aria-label={t('common.actions.delete')}
                        title={t('common.actions.delete')}
                      >
                        <Trash2
                          className="h-3.5 w-3.5 text-destructive"
                          aria-hidden="true"
                        />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
