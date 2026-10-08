/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Atom,
  BookOpen,
  Brain,
  Briefcase,
  CircleDot,
  Clock,
  Code2,
  Edit,
  GraduationCap,
  Globe,
  LayoutGrid,
  MoreHorizontal,
  Paintbrush,
  Palette,
  Plus,
  Radar,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
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
import { PlainButton } from '@/components/ui/plain-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cardVariants } from '@/lib/animations';
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

const SKILL_CATEGORY_ICONS: Record<IntellectCategory, typeof Brain> = {
  technology: Code2,
  languages: Globe,
  design: Palette,
  business: Briefcase,
  science: Atom,
  arts: Paintbrush,
  other: MoreHorizontal,
};

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

function SkillCard({
  skill,
  onEdit,
  onDelete,
  onViewHistory,
}: {
  skill: Skill;
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
      className="group gap-sm border-border bg-card p-md flex flex-col rounded-lg border transition-colors"
    >
      <div className="gap-sm flex items-start justify-between">
        <div className="gap-sm flex min-w-0 flex-1 items-center">
          <div className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <Brain className="text-primary h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{skill.name}</p>
            <p className="text-muted-foreground text-xs">
              {t(`pages.skills.category.${skill.category}`)}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'px-sm shrink-0 rounded-full border py-0.5 text-xs font-semibold',
            STATUS_COLORS[skill.status]
          )}
        >
          {t(`pages.skills.status.${skill.status}`)}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <ProficiencyDots level={skill.proficiency_level} />
        <span className="text-muted-foreground text-xs">
          {t(`pages.skills.proficiency.${skill.proficiency}`)}
        </span>
      </div>

      {skill.notes && (
        <p className="text-muted-foreground line-clamp-2 text-xs">{skill.notes}</p>
      )}

      {(skill.books.length > 0 || skill.courses.length > 0) && (
        <div className="space-y-xs border-border/40 pt-xs border-t">
          <p className="text-muted-foreground text-2xs font-semibold tracking-wider uppercase">
            {t('pages.skills.developedWith')}
          </p>
          <div className="gap-xs flex flex-wrap">
            {skill.books.slice(0, 2).map((b) => (
              <span
                key={b.id}
                className="bg-primary/10 px-xs text-primary text-2xs flex items-center gap-0.5 rounded-full py-0.5"
              >
                <BookOpen className="h-2.5 w-2.5" />
                {b.title.length > 18 ? b.title.slice(0, 18) + '…' : b.title}
              </span>
            ))}
            {skill.courses.slice(0, 2).map((c) => (
              <span
                key={c.id}
                className="bg-info/10 px-xs text-info text-2xs flex items-center gap-0.5 rounded-full py-0.5"
              >
                <GraduationCap className="h-2.5 w-2.5" />
                {c.title.length > 18 ? c.title.slice(0, 18) + '…' : c.title}
              </span>
            ))}
            {skill.books.length + skill.courses.length > 4 && (
              <span className="bg-muted px-xs text-muted-foreground text-2xs rounded-full py-0.5">
                +{skill.books.length + skill.courses.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="gap-xs flex">
        <Button
          size="sm"
          variant="ghost"
          className="gap-xs h-7 flex-1 text-xs"
          onClick={() => onEdit(skill)}
        >
          <Edit className="h-3 w-3" />
          {t('common.actions.edit')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-xs h-7 text-xs"
          title={t('pages.skills.history.viewHistory')}
          onClick={() => onViewHistory(skill)}
        >
          <Clock className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-xs text-destructive hover:text-destructive h-7 flex-1 text-xs"
          onClick={() => onDelete(skill)}
        >
          <Trash2 className="h-3 w-3" />
          {t('common.actions.delete')}
        </Button>
      </div>
    </motion.div>
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

  const params: Record<string, unknown> = { page_size: 200 };
  if (search) params.search = search;

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skills', search],
    queryFn: () => skillsService.getAll(params),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['skills'] });

  const createMutation = useMutation({
    mutationFn: (data: SkillFormData) => skillsService.create(data),
    onSuccess: () => {
      toast({ title: t('pages.skills.saved') });
      setFormOpen(false);
      setEditingSkill(null);
      void invalidate();
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: 'destructive' }),
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
    onError: (err) => toast({ title: getErrorMessage(err), variant: 'destructive' }),
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

  const masteredCount = skills.filter((s) => s.status === 'mastered').length;
  const learningCount = skills.filter((s) => s.status === 'learning').length;

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
            <Button
              onClick={() => {
                setEditingSkill(null);
                setFormOpen(true);
              }}
              className="gap-sm bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              {t('pages.skills.newBtn')}
            </Button>
          }
        />

        {/* Stats */}
        <div className="gap-md grid grid-cols-3">
          {[
            {
              label: t('common.actions.total'),
              value: skills.length,
              color: 'text-foreground',
            },
            {
              label: t('pages.skills.status.mastered'),
              value: masteredCount,
              color: 'text-success',
            },
            {
              label: t('pages.skills.status.learning'),
              value: learningCount,
              color: 'text-info',
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="gap-md border-border bg-card p-md flex items-center rounded-lg border"
            >
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <Brain className="text-primary h-5 w-5" />
              </div>
              <div>
                <p className={cn('text-xl font-bold', color)}>{value}</p>
                <p className="text-muted-foreground text-xs">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search + View Toggle */}
        <div className="gap-sm flex items-center">
          <FilterBar
            className="flex-1"
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
            <SearchInput
              placeholder={t('pages.skills.searchPlaceholder')}
              value={search}
              onValueChange={setSearch}
            />
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
                {SKILL_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`pages.skills.status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          </FilterBar>
          <div className="border-border flex rounded-lg border">
            <PlainButton
              aria-label={t('pages.skills.viewList')}
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'px-md py-sm rounded-l-lg transition-colors',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </PlainButton>
            <PlainButton
              aria-label={t('pages.skills.viewRadar')}
              type="button"
              onClick={() => setViewMode('radar')}
              className={cn(
                'px-md py-sm rounded-r-lg transition-colors',
                viewMode === 'radar'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Radar className="h-4 w-4" />
            </PlainButton>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingState />
        ) : viewMode === 'radar' ? (
          <div className="gap-md grid lg:grid-cols-2">
            <SkillsRadarChart skills={filteredSkills} />
            <div className="space-y-sm">
              {filteredSkills.slice(0, 8).map((skill) => (
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
              ))}
            </div>
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
              className="gap-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {(pageItems) =>
                pageItems.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
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
            <DialogHeader sticky>
              <div className="gap-sm flex items-center">
                <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-lg">
                  <Brain className="text-primary h-4 w-4" />
                </div>
                <div>
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
                </div>
              </div>
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

        {/* Skill History Dialog */}
        <Dialog
          open={!!historySkill}
          onOpenChange={(v) => {
            if (!v) setHistorySkill(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="gap-sm flex items-center">
                <Clock className="text-primary h-4 w-4" />
                {t('pages.skills.history.title')}
                {historySkill && (
                  <span className="text-muted-foreground">— {historySkill.name}</span>
                )}
              </DialogTitle>
              <DialogDescription>
                {t('pages.skills.history.timeline')}
              </DialogDescription>
            </DialogHeader>
            {historyLoading ? (
              <LoadingState />
            ) : !historyData?.results?.length ? (
              <EmptyState title={t('pages.skills.history.noHistory')} />
            ) : (
              <div className="relative space-y-0 pl-5">
                <div className="bg-border absolute top-0 left-2 h-full w-px" />
                {historyData.results.map((entry, i) => (
                  <div key={entry.id} className="pb-md relative">
                    <div
                      className={cn(
                        'border-background absolute -left-3 flex h-5 w-5 items-center justify-center rounded-full border-2',
                        i === 0 ? 'bg-primary' : 'bg-muted'
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
                        {new Date(entry.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <DialogCloseFooter />
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AnimatedPage>
  );
}
