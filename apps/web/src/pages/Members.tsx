/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  CheckCircle2,
  CircleDot,
  HandCoins,
  Plus,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Can } from '@/components/common/Can';
import { CardActions } from '@/components/common/CardActions';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { MemberDetailModal } from '@/components/members/MemberDetailModal';
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
import { cn } from '@/lib/utils';
import { membersService } from '@/services/members-service';
import type { Member, MemberFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const SEX_COLORS: Record<string, { bg: string; text: string }> = {
  M: { bg: 'bg-info/15', text: 'text-info' },
  F: { bg: 'bg-category-spiritual/15', text: 'text-category-spiritual' },
  O: { bg: 'bg-category-intellect/15', text: 'text-category-intellect' },
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

/** Desktop (lg+): 8 cards por página; demais telas mantêm o padrão da grade. */
const DESKTOP_QUERY = '(min-width: 1024px)';
const DESKTOP_PAGE_SIZE = 8;

function useMembersPageSize() {
  const [pageSize, setPageSize] = useState(() =>
    window.matchMedia(DESKTOP_QUERY).matches ? DESKTOP_PAGE_SIZE : GRID_PAGE_SIZE
  );

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const handler = (e: MediaQueryListEvent) =>
      setPageSize(e.matches ? DESKTOP_PAGE_SIZE : GRID_PAGE_SIZE);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return pageSize;
}

export default function Members() {
  const membersPageSize = useMembersPageSize();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const memberRoles = (m: Member) =>
    [
      m.is_creditor && t('pages.members.form.isCreditor'),
      m.is_benefited && t('pages.members.form.isBenefited'),
    ]
      .filter(Boolean)
      .join(' · ') || t('pages.members.noRole');
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
        <Can action="add">
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
        </Can>
      </PageHeader>

      <FilterBar
        hasActiveFilters={!!searchTerm || hasExtraFilters}
        onClear={clearAllFilters}
      >
        <FilterField label={t('common.filterLabels.search')} icon={Search}>
          <SearchInput
            placeholder={t('pages.members.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
        </FilterField>
        <FilterField label={t('common.fields.status')} icon={CheckCircle2}>
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
        <FilterField label={t('common.filterLabels.role')} icon={Shield}>
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
          pageSize={membersPageSize}
          centerList
          className="gap-md grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {(pageItems) =>
            pageItems.map((member) => {
              const isCurrentUser = currentUserMemberId === member.id;
              const StatusIcon =
                TASK_STATUS_ICONS[member.active ? 'active' : 'inactive'];
              // Card enxuto (§5): avatar, nome, papéis e status; o resto no detalhe.
              return (
                <Card
                  key={member.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest('button'))
                      setDetailMember(member);
                  }}
                  onKeyDown={(e) => {
                    if (
                      (e.key === 'Enter' || e.key === ' ') &&
                      !(e.target as HTMLElement).closest('button')
                    ) {
                      e.preventDefault();
                      setDetailMember(member);
                    }
                  }}
                  className={cn(
                    'flex cursor-pointer flex-col overflow-hidden',
                    !member.active && 'opacity-60'
                  )}
                >
                  <div className="p-md flex items-start gap-3">
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
                            {t('pages.members.you')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground truncate text-xs">
                        {memberRoles(member)}
                      </p>
                    </div>
                    <Badge
                      variant={member.active ? 'success' : 'outline'}
                      className="gap-xs shrink-0 text-xs"
                    >
                      <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      {member.active
                        ? t('common.status.active')
                        : t('common.status.inactive')}
                    </Badge>
                  </div>

                  <CardContent className="pb-sm mt-auto">
                    <div className="pt-sm gap-xs flex items-center justify-end border-t">
                      <CardActions
                        onEdit={() => {
                          setSelectedMember(member);
                          setIsDialogOpen(true);
                        }}
                        onDelete={() => handleDelete(member.id)}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          }
        </PaginatedSlide>
      )}

      <MemberDetailModal
        member={detailMember}
        roles={detailMember ? memberRoles(detailMember) : ''}
        onClose={() => setDetailMember(null)}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
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
