/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Brain,
  CheckCircle2,
  CircleDot,
  Clock,
  GraduationCap,
  LayoutGrid,
  Plus,
  Radar,
  Search,
  Tag,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { CardActions } from '@/components/common/CardActions';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import {
  GRID_PAGE_SIZE,
  LIST_PAGE_SIZE,
  PaginatedSlide,
} from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { ViewModeToggle } from '@/components/common/ViewModeToggle';
import { SkillForm } from '@/components/library/SkillForm';
import { SkillsRadarChart } from '@/components/library/SkillsRadarChart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogCloseFooter,
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
import { SKILL_CATEGORY_ICONS, SKILL_STATUS_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cardVariants } from '@/lib/animations';
import { serverFieldError } from '@/lib/form-errors';
import { formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { membersService } from '@/services/members-service';
import { skillHistoryService } from '@/services/skill-history-service';
import { skillsService } from '@/services/skills-service';
import type { IntellectCategory, Skill, SkillFormData, SkillStatus } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type ViewMode = 'list' | 'radar';

const STATUS_COLORS: Record<SkillStatus, string> = {
  learning: 'bg-info/10 text-info border-info/30',
  evolving: 'bg-warning/10 text-warning border-warning/30',
  mastered: 'bg-success/10 text-success border-success/30',
};

const SKILL_STATUSES: SkillStatus[] = ['learning', 'evolving', 'mastered'];

const SKILL_CATEGORIES: IntellectCategory[] = [
  'technology',
  'languages',
  'design',
  'business',
  'science',
  'arts',
  'other',
];

function ProficiencyDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-2 w-2 rounded-full',
            i < level ? 'bg-primary' : 'bg-muted-foreground/20'
          )}
        />
      ))}
    </div>
  );
}

function SkillStatusBadge({ skill }: { skill: Skill }) {
  const { t } = useTranslation();
  const StatusIcon = SKILL_STATUS_ICONS[skill.status];
  return (
    <span
      className={cn(
        'px-sm gap-xs inline-flex shrink-0 items-center rounded-full border py-0.5 text-xs font-semibold',
        STATUS_COLORS[skill.status]
      )}
    >
      {StatusIcon && <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />}
      {t(`pages.skills.status.${skill.status}`)}
    </span>
  );
}

/**
 * Card de grade (§5): ícone + nome + categoria + proficiência (métrica) +
 * status. Notas e livros/cursos relacionados ficam no modal de detalhe.
 */
function SkillCard({
  skill,
  onOpen,
  onEdit,
  onDelete,
  onViewHistory,
}: {
  skill: Skill;
  onOpen: (s: Skill) => void;
  onEdit: (s: Skill) => void;
  onDelete: (s: Skill) => void;
  onViewHistory: (s: Skill) => void;
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      role="button"
      tabIndex={0}
      onClick={() => onOpen(skill)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen(skill);
      }}
      className="border-border bg-card flex cursor-pointer flex-col rounded-lg border"
    >
      <div className="gap-sm px-md py-sm flex flex-1 items-center">
        <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <Brain className="text-primary h-5 w-5" />
        </div>
        <div className="space-y-xs min-w-0 flex-1">
          <div className="gap-sm flex items-start justify-between">
            <p className="truncate text-sm font-semibold">{skill.name}</p>
            <SkillStatusBadge skill={skill} />
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {t(`pages.skills.category.${skill.category}`)}
          </p>
          <div className="gap-sm flex items-center">
            <ProficiencyDots level={skill.proficiency_level} />
            <span className="text-muted-foreground text-xs">
              {t(`pages.skills.proficiency.${skill.proficiency}`)}
            </span>
          </div>
        </div>
      </div>
      <div
        role="presentation"
        className="gap-xs px-sm py-xs flex items-center justify-end border-t"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <CardActions
          onEdit={() => onEdit(skill)}
          onDelete={() => onDelete(skill)}
          menuActions={[
            {
              icon: Clock,
              label: t('pages.skills.history.viewHistory'),
              onClick: () => onViewHistory(skill),
              color: 'progress',
            },
          ]}
        />
      </div>
    </motion.div>
  );
}

function SkillDetailModal({
  skill,
  onClose,
}: {
  skill: Skill | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={!!skill} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        {skill && (
          <>
            <DialogHeader>
              <DialogTitle icon={Brain}>{skill.name}</DialogTitle>
              <VisuallyHidden>
                <DialogDescription>{t('pages.skills.detailDesc')}</DialogDescription>
              </VisuallyHidden>
            </DialogHeader>
            <div className="gap-sm flex flex-wrap items-center">
              <SkillStatusBadge skill={skill} />
              <Badge variant="outline">
                {t(`pages.skills.category.${skill.category}`)}
              </Badge>
            </div>
            <div className="gap-sm flex items-center">
              <ProficiencyDots level={skill.proficiency_level} />
              <span className="text-sm">
                {t(`pages.skills.proficiency.${skill.proficiency}`)}
              </span>
            </div>
            {skill.notes && (
              <p
                className="text-muted-foreground line-clamp-6 text-sm leading-relaxed"
                title={skill.notes}
              >
                {skill.notes}
              </p>
            )}
            {(skill.books.length > 0 || skill.courses.length > 0) && (
              <div className="space-y-xs">
                <p className="text-muted-foreground text-xs font-medium">
                  {t('pages.skills.developedWith')}
                </p>
                <div className="gap-xs flex flex-wrap">
                  {skill.books.map((b) => (
                    <Badge key={`b-${b.id}`} variant="secondary" className="gap-xs">
                      <BookOpen className="h-3 w-3" />
                      {b.title}
                    </Badge>
                  ))}
                  {skill.courses.map((c) => (
                    <Badge key={`c-${c.id}`} variant="secondary" className="gap-xs">
                      <GraduationCap className="h-3 w-3" />
                      {c.title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <DialogCloseFooter />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Skills() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [historySkill, setHistorySkill] = useState<Skill | null>(null);
  const [detailSkill, setDetailSkill] = useState<Skill | null>(null);

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['skill-history', historySkill?.id],
    queryFn: () => skillHistoryService.getHistory(historySkill!.id),
    enabled: !!historySkill,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: member } = useQuery({
    queryKey: ['member-me'],
    queryFn: () => membersService.getCurrentUserMember(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const params: Record<string, unknown> = {};
  if (search) params.search = search;

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skills', search],
    queryFn: () => skillsService.getAllPages(params),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['skills'] });

  // Nome duplicado fica com o SkillForm (borda + toast traduzido).
  const notifyMutationError = (err: unknown) => {
    if (serverFieldError(err, 'name')) return;
    toast({ title: getErrorMessage(err), variant: 'destructive' });
  };

  const createMutation = useMutation({
    mutationFn: (data: SkillFormData) => skillsService.create(data),
    onSuccess: () => {
      toast({ title: t('pages.skills.saved') });
      setFormOpen(false);
      setEditingSkill(null);
      void invalidate();
    },
    onError: notifyMutationError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SkillFormData }) =>
      skillsService.update(id, data),
    onSuccess: () => {
      toast({ title: t('pages.skills.updated') });
      setFormOpen(false);
      setEditingSkill(null);
      void invalidate();
    },
    onError: notifyMutationError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => skillsService.delete(id),
    onSuccess: () => {
      toast({ title: t('pages.skills.deleted') });
      void invalidate();
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });

  const handleSubmit = async (data: SkillFormData) => {
    if (editingSkill) {
      await updateMutation.mutateAsync({ id: editingSkill.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleDelete = (skill: Skill) => {
    void showConfirm({
      title: t('common.messages.confirmDeleteTitle'),
      description: t('pages.skills.deleteConfirm', { name: skill.name }),
    }).then((ok) => {
      if (ok) deleteMutation.mutate(skill.id);
    });
  };

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setFormOpen(true);
  };

  const filteredSkills = skills.filter(
    (s) =>
      (statusFilter === 'all' || s.status === statusFilter) &&
      (categoryFilter === 'all' || s.category === categoryFilter)
  );

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('pages.skills.title')}
          icon={<Brain className="text-primary h-6 w-6" />}
          actions={
            <div className="gap-sm flex items-center">
              {/* Toggle de visualização na linha do título (§4). */}
              <ViewModeToggle
                value={viewMode}
                onChange={setViewMode}
                options={[
                  {
                    value: 'list',
                    label: t('pages.skills.viewList'),
                    icon: LayoutGrid,
                  },
                  { value: 'radar', label: t('pages.skills.viewRadar'), icon: Radar },
                ]}
              />
              <Button
                onClick={() => {
                  setEditingSkill(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                {t('pages.skills.newBtn')}
              </Button>
            </div>
          }
        />

        <FilterBar
          hasActiveFilters={
            !!search || statusFilter !== 'all' || categoryFilter !== 'all'
          }
          onClear={() => {
            setSearch('');
            setStatusFilter('all');
            setCategoryFilter('all');
          }}
          activeFilters={[
            ...(statusFilter !== 'all'
              ? [
                  {
                    key: 'status',
                    label: `${t('pages.skills.allStatus')}: ${t(`pages.skills.status.${statusFilter}`)}`,
                    onRemove: () => setStatusFilter('all'),
                  },
                ]
              : []),
            ...(categoryFilter !== 'all'
              ? [
                  {
                    key: 'category',
                    label: `${t('pages.skills.allCategories')}: ${t(`pages.skills.category.${categoryFilter}`)}`,
                    onRemove: () => setCategoryFilter('all'),
                  },
                ]
              : []),
          ]}
        >
          <FilterField label={t('common.filterLabels.search')} icon={Search}>
            <SearchInput
              placeholder={t('pages.skills.searchPlaceholder')}
              value={search}
              onValueChange={setSearch}
            />
          </FilterField>
          <FilterField label={t('common.fields.status')} icon={CheckCircle2}>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                className="w-36"
                aria-label={t('pages.skills.allStatus')}
                startIcon={<CircleDot className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.skills.allStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.skills.allStatus')}</SelectItem>
                {SKILL_STATUSES.map((status) => {
                  const StatusIcon = SKILL_STATUS_ICONS[status];
                  return (
                    <SelectItem
                      key={status}
                      value={status}
                      icon={<StatusIcon className="h-4 w-4" />}
                    >
                      {t(`pages.skills.status.${status}`)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label={t('common.fields.category')} icon={Tag}>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger
                className="w-40"
                aria-label={t('pages.skills.allCategories')}
                startIcon={<Brain className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.skills.allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.skills.allCategories')}</SelectItem>
                {SKILL_CATEGORIES.map((category) => {
                  const Icon = SKILL_CATEGORY_ICONS[category];
                  return (
                    <SelectItem
                      key={category}
                      value={category}
                      icon={<Icon className="h-4 w-4" />}
                    >
                      {t(`pages.skills.category.${category}`)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FilterField>
        </FilterBar>

        {/* Content */}
        {isLoading ? (
          <LoadingState />
        ) : viewMode === 'radar' ? (
          <div className="gap-md grid lg:grid-cols-2">
            <SkillsRadarChart skills={filteredSkills} />
            <PaginatedSlide
              items={filteredSkills}
              pageSize={LIST_PAGE_SIZE}
              pinNav={false}
              className="space-y-sm"
            >
              {(pageItems) =>
                pageItems.map((skill) => (
                  <div
                    key={skill.id}
                    className="border-border bg-card px-md py-sm flex items-center justify-between rounded-lg border"
                  >
                    <div className="gap-sm flex items-center">
                      <ProficiencyDots level={skill.proficiency_level} />
                      <span className="text-sm font-medium">{skill.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {t(`pages.skills.category.${skill.category}`)}
                    </Badge>
                  </div>
                ))
              }
            </PaginatedSlide>
          </div>
        ) : filteredSkills.length === 0 ? (
          <EmptyState
            title={
              search || statusFilter !== 'all' || categoryFilter !== 'all'
                ? t('pages.skills.emptySearch')
                : t('pages.skills.emptyState')
            }
            icon={<Brain className="text-muted-foreground h-10 w-10" />}
          />
        ) : (
          <AnimatePresence>
            <PaginatedSlide
              key={`${search}-${statusFilter}-${categoryFilter}`}
              items={filteredSkills}
              pageSize={GRID_PAGE_SIZE}
              className="gap-md grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
            >
              {(pageItems) =>
                pageItems.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onOpen={setDetailSkill}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onViewHistory={(s) => setHistorySkill(s)}
                  />
                ))
              }
            </PaginatedSlide>
          </AnimatePresence>
        )}

        {/* Skill Form Dialog */}
        <Dialog
          open={formOpen}
          onOpenChange={(v) => {
            if (!v) {
              setFormOpen(false);
              setEditingSkill(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle mode={editingSkill ? 'edit' : 'create'}>
                {editingSkill
                  ? t('pages.skills.editTitle')
                  : t('pages.skills.newTitle')}
              </DialogTitle>
              <VisuallyHidden>
                <DialogDescription>
                  {editingSkill
                    ? t('pages.skills.editDesc')
                    : t('pages.skills.newDesc')}
                </DialogDescription>
              </VisuallyHidden>
            </DialogHeader>
            <SkillForm
              skill={editingSkill ?? undefined}
              ownerId={member?.id ?? 0}
              onSubmit={handleSubmit}
              onCancel={() => {
                setFormOpen(false);
                setEditingSkill(null);
              }}
              isLoading={createMutation.isPending || updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Skill History Dialog — abre só com o histórico carregado (§7) */}
        <Dialog
          open={!!historySkill && !historyLoading}
          onOpenChange={(v) => {
            if (!v) setHistorySkill(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle icon={Clock}>
                {t('pages.skills.history.title')}
                {historySkill && (
                  <span className="text-muted-foreground"> — {historySkill.name}</span>
                )}
              </DialogTitle>
              <VisuallyHidden>
                <DialogDescription>
                  {t('pages.skills.history.timeline')}
                </DialogDescription>
              </VisuallyHidden>
            </DialogHeader>
            {!historyData?.results?.length ? (
              <EmptyState title={t('pages.skills.history.noHistory')} />
            ) : (
              <PaginatedSlide
                items={historyData.results}
                pageSize={LIST_PAGE_SIZE}
                pinNav={false}
                className="relative pl-5"
              >
                {(pageEntries) => (
                  <>
                    <div className="bg-border absolute top-0 left-2 h-full w-px" />
                    {pageEntries.map((entry) => (
                      <div key={entry.id} className="pb-md relative">
                        <div
                          className={cn(
                            'border-background absolute -left-3 flex h-5 w-5 items-center justify-center rounded-full border-2',
                            entry.id === historyData.results[0].id
                              ? 'bg-primary'
                              : 'bg-muted'
                          )}
                        >
                          <div className="bg-background h-2 w-2 rounded-full" />
                        </div>
                        <div className="ml-md">
                          <p className="text-sm font-medium">
                            {t(`pages.skills.proficiency.${entry.proficiency}`)}
                            <span className="ml-xs text-muted-foreground text-xs font-normal">
                              · {t(`pages.skills.status.${entry.status}`)}
                            </span>
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {formatDate(entry.created_at, 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </PaginatedSlide>
            )}
            <DialogCloseFooter />
          </DialogContent>
        </Dialog>

        <SkillDetailModal skill={detailSkill} onClose={() => setDetailSkill(null)} />
      </PageContainer>
    </AnimatedPage>
  );
}
