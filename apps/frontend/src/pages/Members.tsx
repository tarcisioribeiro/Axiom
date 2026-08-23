/* eslint-disable max-lines */
import {
  ChartBarSquareIcon as BarChart3,
  PencilIcon as Pencil,
  PlusIcon as Plus,
  TrashIcon as Trash2,
  UsersIcon as Users,
  BanknotesIcon as Banknote,
  BanknotesIcon as HandCoins,
  UserPlusIcon as UserCheck,
  PhoneIcon as Phone,
  EnvelopeIcon as Mail,
} from '@heroicons/react/24/solid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

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

const EMPTY_MEMBERS: Member[] = [];

export default function Members() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      try {
        const [data, currentUserMemberId] = await Promise.all([
          membersService.getAll(),
          membersService
            .getCurrentUserMember()
            .then((m) => m.id)
            .catch(() => null),
        ]);
        return { members: data, currentUserMemberId };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        return { members: EMPTY_MEMBERS, currentUserMemberId: null };
      }
    },
  });
  const members = pageData?.members ?? EMPTY_MEMBERS;
  const currentUserMemberId = pageData?.currentUserMemberId ?? null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['members'] });

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
      void refresh();
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
      void refresh();
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
          placeholder={t('pages.members.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="w-52 sm:w-64"
        />
      </FilterBar>

      {/* Stat cards */}
      {members.length > 0 && (
        <div className="gap-md grid grid-cols-2 lg:grid-cols-4">
          <Card className="border-t-primary/60 overflow-hidden border-t-2">
            <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
              <p className="text-sm font-medium">{t('pages.members.title')}</p>
              <div className="bg-primary/10 p-sm ring-primary/20 rounded-lg ring-1">
                <Users className="text-primary h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-primary text-2xl font-bold">{members.length}</div>
              <p className="mt-xs text-muted-foreground text-xs">
                {t('pages.members.stats.registeredSubtitle')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-t-success/60 overflow-hidden border-t-2">
            <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
              <p className="text-sm font-medium">{t('pages.members.stats.active')}</p>
              <div className="bg-success/10 p-sm ring-success/20 rounded-lg ring-1">
                <UserCheck className="text-success h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-success text-2xl font-bold">{activeCount}</div>
              <p className="mt-xs text-muted-foreground text-xs">
                {t('pages.members.stats.activeSubtitle')}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-t-2 border-t-blue-500/60">
            <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
              <p className="text-sm font-medium">
                {t('pages.members.stats.creditors')}
              </p>
              <div className="p-sm rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20">
                <Banknote className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {creditorCount}
              </div>
              <p className="mt-xs text-muted-foreground text-xs">
                {t('pages.members.stats.creditorsSubtitle')}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-t-2 border-t-emerald-500/60">
            <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
              <p className="text-sm font-medium">
                {t('pages.members.stats.beneficiaries')}
              </p>
              <div className="p-sm rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <HandCoins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {beneficiaryCount}
              </div>
              <p className="mt-xs text-muted-foreground text-xs">
                {t('pages.members.stats.beneficiariesSubtitle')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {filteredMembers.length === 0 ? (
        <EmptyState
          icon={<Users className="text-muted-foreground h-12 w-12" />}
          message={
            searchTerm ? t('pages.members.emptySearch') : t('pages.members.emptyState')
          }
        />
      ) : (
        <div className="gap-md grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredMembers.map((member) => {
            const isCurrentUser = currentUserMemberId === member.id;
            return (
              <Card
                key={member.id}
                className={cn(
                  'overflow-hidden transition-shadow hover:shadow-md',
                  isCurrentUser && 'ring-primary/40 ring-2',
                  !member.active && 'opacity-60'
                )}
              >
                {/* Header com avatar e nome */}
                <div className="from-muted/50 p-md flex items-start gap-3 bg-gradient-to-r to-transparent">
                  <MemberInitials name={member.name} sex={member.sex} />
                  <div className="min-w-0 flex-1">
                    <div className="gap-sm flex items-center">
                      <p className="truncate leading-tight font-semibold">
                        {member.name}
                      </p>
                      {isCurrentUser && (
                        <Badge
                          variant="secondary"
                          className="px-sm text-2xs shrink-0 py-0"
                        >
                          Você
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {format(new Date(member.created_at), 'dd/MM/yyyy')}
                    </p>
                    {/* Papéis */}
                    <div className="mt-sm gap-xs flex flex-wrap">
                      {member.is_creditor && (
                        <span className="gap-xs px-sm text-2xs inline-flex items-center rounded-full bg-blue-500/10 py-0.5 font-semibold text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400">
                          <Banknote className="h-2.5 w-2.5" />
                          {t('pages.members.form.isCreditor')}
                        </span>
                      )}
                      {member.is_benefited && (
                        <span className="gap-xs px-sm text-2xs inline-flex items-center rounded-full bg-emerald-500/10 py-0.5 font-semibold text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
                          <HandCoins className="h-2.5 w-2.5" />
                          {t('pages.members.form.isBenefited')}
                        </span>
                      )}
                      {!member.is_creditor && !member.is_benefited && (
                        <span className="text-muted-foreground text-2xs">
                          {t('pages.members.noRole')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dados de contato */}
                <CardContent className="space-y-sm py-3">
                  {member.phone && (
                    <div className="gap-sm text-muted-foreground flex items-center text-xs">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span>{member.phone}</span>
                    </div>
                  )}
                  {member.email && (
                    <div className="gap-sm text-muted-foreground flex items-center text-xs">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  )}
                  {member.document && (
                    <p className="text-muted-foreground font-mono text-xs">
                      {member.document}
                    </p>
                  )}
                  {member.monthly_income && (
                    <div className="bg-muted/50 px-sm py-xs rounded text-xs">
                      <span className="text-muted-foreground">
                        {t('pages.members.stats.income')}{' '}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(parseFloat(member.monthly_income))}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-sm flex items-center justify-between border-t">
                    <Badge
                      variant={member.active ? 'success' : 'outline'}
                      className="text-xs"
                    >
                      {member.active
                        ? t('common.status.active')
                        : t('common.status.inactive')}
                    </Badge>
                    <div className="gap-xs flex">
                      {isCurrentUser && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navigate(`/members/${member.id}/report`)}
                          aria-label={t('pages.members.viewReport')}
                          title={t('pages.members.viewReport')}
                        >
                          <BarChart3 className="h-4 w-4" aria-hidden="true" />
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
                        <Pencil className="h-4 w-4" aria-hidden="true" />
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
                          className="text-destructive h-4 w-4"
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
