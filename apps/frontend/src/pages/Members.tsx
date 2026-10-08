/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Pencil,
  Plus,
  Trash2,
  Users,
  Banknote,
  HandCoins,
  Phone,
  Mail,
  CircleDot,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { MemberForm } from '@/components/members/MemberForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { TASK_STATUS_ICONS } from '@/config/icons';
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
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
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
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
          variant: 'destructive',
        });
        return { members: EMPTY_MEMBERS, currentUserMemberId: null };
      }
    },
  });
  const members = pageData?.members ?? EMPTY_MEMBERS;
  const currentUserMemberId = pageData?.currentUserMemberId ?? null;

  const refresh = () => {
    // 'current-member' is cached separately (BodyMetrics, WorkoutPage,
    // NutritionPage, etc. all key off it for age-dependent calculations) —
    // invalidate it too so a birth_date edit reflects immediately instead of
    // waiting out its own staleTime.
    void queryClient.invalidateQueries({ queryKey: ['members'] });
    void queryClient.invalidateQueries({ queryKey: ['current-member'] });
  };

  const handleSubmit = async (data: MemberFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedMember) {
        await membersService.update(selectedMember.id, data);
        toast({
          title: t('pages.members.updated'),
        });
      } else {
        await membersService.create(data);
        toast({
          title: t('pages.members.created'),
        });
      }
      setIsDialogOpen(false);
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
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
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const filteredMembers = useMemo(() => {
    let result = members;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.document.toLowerCase().includes(q) ||
          m.phone.toLowerCase().includes(q) ||
          (m.email ?? '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all')
      result = result.filter((m) => m.active === (statusFilter === 'active'));
    if (roleFilter === 'creditor') result = result.filter((m) => m.is_creditor);
    if (roleFilter === 'benefited') result = result.filter((m) => m.is_benefited);
    return result;
  }, [members, searchTerm, statusFilter, roleFilter]);

  const hasExtraFilters = statusFilter !== 'all' || roleFilter !== 'all';
  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setRoleFilter('all');
  };

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

      <FilterBar
        hasActiveFilters={!!searchTerm || hasExtraFilters}
        onClear={clearAllFilters}
        activeFilters={[
          ...(statusFilter !== 'all'
            ? [
                {
                  key: 'status',
                  label: `${t('common.fields.status')}: ${
                    statusFilter === 'active'
                      ? t('common.status.active')
                      : t('common.status.inactive')
                  }`,
                  onRemove: () => setStatusFilter('all'),
                },
              ]
            : []),
          ...(roleFilter !== 'all'
            ? [
                {
                  key: 'role',
                  label:
                    roleFilter === 'creditor'
                      ? t('common.fields.is_creditor')
                      : t('common.fields.is_benefited'),
                  onRemove: () => setRoleFilter('all'),
                },
              ]
            : []),
        ]}
      >
        <FilterField label={t('common.filterLabels.search')}>
          <SearchInput
            placeholder={t('pages.members.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
        </FilterField>
        <FilterField label={t('common.fields.status')}>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="w-36"
              aria-label={t('pages.members.allStatus')}
              startIcon={<CircleDot className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.members.allStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.members.allStatus')}</SelectItem>
              <SelectItem
                value="active"
                icon={<TASK_STATUS_ICONS.active className="h-4 w-4" />}
              >
                {t('common.status.active')}
              </SelectItem>
              <SelectItem
                value="inactive"
                icon={<TASK_STATUS_ICONS.inactive className="h-4 w-4" />}
              >
                {t('common.status.inactive')}
              </SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('common.filterLabels.role')}>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger
              className="w-40"
              aria-label={t('pages.members.allRoles')}
              startIcon={<Users className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.members.allRoles')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.members.allRoles')}</SelectItem>
              <SelectItem value="creditor" icon={<Banknote className="h-4 w-4" />}>
                {t('common.fields.is_creditor')}
              </SelectItem>
              <SelectItem value="benefited" icon={<HandCoins className="h-4 w-4" />}>
                {t('common.fields.is_benefited')}
              </SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {filteredMembers.length === 0 ? (
        <EmptyState
          icon={<Users className="text-muted-foreground h-12 w-12" />}
          title={
            searchTerm || hasExtraFilters
              ? t('pages.members.emptySearch')
              : t('pages.members.emptyState')
          }
        />
      ) : (
        <PaginatedSlide
          key={`${searchTerm}-${statusFilter}-${roleFilter}`}
          items={filteredMembers}
          pageSize={LIST_PAGE_SIZE}
          centerList
          className="gap-md grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {(pageItems) =>
            pageItems.map((member) => {
              const isCurrentUser = currentUserMemberId === member.id;
              return (
                <Card
                  key={member.id}
                  className={cn(
                    'flex flex-col overflow-hidden transition-colors',
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
                  <CardContent className="space-y-sm flex flex-1 flex-col py-3">
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
                      <p className="text-muted-foreground text-xs">{member.document}</p>
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
                    <div className="pt-sm mt-auto flex items-center justify-between border-t">
                      <Badge
                        variant={member.active ? 'success' : 'outline'}
                        className="gap-xs text-xs"
                      >
                        {(() => {
                          const StatusIcon =
                            TASK_STATUS_ICONS[member.active ? 'active' : 'inactive'];
                          return (
                            <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          );
                        })()}
                        {member.active
                          ? t('common.status.active')
                          : t('common.status.inactive')}
                      </Badge>
                      <div className="gap-xs flex">
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
            })
          }
        </PaginatedSlide>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader sticky>
            <DialogTitle mode={selectedMember ? 'edit' : 'create'}>
              {selectedMember
                ? t('pages.members.editTitle')
                : t('pages.members.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {selectedMember
                  ? t('pages.members.editDesc')
                  : t('pages.members.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
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
