/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, Edit, LayoutGrid, Plus, Radar, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SkillForm } from '@/components/library/SkillForm';
import { SkillsRadarChart } from '@/components/library/SkillsRadarChart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cardVariants } from '@/lib/animations';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { membersService } from '@/services/members-service';
import { skillsService } from '@/services/skills-service';
import type { Skill, SkillFormData, SkillStatus } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type ViewMode = 'list' | 'radar';

const STATUS_COLORS: Record<SkillStatus, string> = {
  learning: 'bg-info/10 text-info border-info/30',
  evolving: 'bg-warning/10 text-warning border-warning/30',
  mastered: 'bg-success/10 text-success border-success/30',
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
}: {
  skill: Skill;
  onEdit: (s: Skill) => void;
  onDelete: (s: Skill) => void;
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className="group flex flex-col gap-sm rounded-lg border border-border bg-card p-md shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-sm">
        <div className="flex min-w-0 flex-1 items-center gap-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{skill.name}</p>
            <p className="text-xs text-muted-foreground">{skill.category_display}</p>
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full border px-sm py-0.5 text-xs font-semibold',
            STATUS_COLORS[skill.status]
          )}
        >
          {skill.status_display}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <ProficiencyDots level={skill.proficiency_level} />
        <span className="text-xs text-muted-foreground">
          {skill.proficiency_display}
        </span>
      </div>

      {skill.notes && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{skill.notes}</p>
      )}

      <div className="flex gap-xs opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 flex-1 gap-xs text-xs"
          onClick={() => onEdit(skill)}
        >
          <Edit className="h-3 w-3" />
          {t('common.actions.edit')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 flex-1 gap-xs text-xs text-destructive hover:text-destructive"
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
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

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

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('pages.skills.title')}
          subtitle={t('pages.skills.subtitle')}
          icon={<Brain className="h-6 w-6 text-primary" />}
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
        <div className="grid grid-cols-3 gap-md">
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
              className="flex items-center gap-md rounded-lg border border-border bg-card p-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className={cn('text-xl font-bold', color)}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search + View Toggle */}
        <div className="flex items-center gap-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t('pages.skills.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-l-lg px-md py-sm transition-colors',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('radar')}
              className={cn(
                'rounded-r-lg px-md py-sm transition-colors',
                viewMode === 'radar'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Radar className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingState />
        ) : viewMode === 'radar' ? (
          <div className="grid gap-md lg:grid-cols-2">
            <SkillsRadarChart skills={skills} />
            <div className="space-y-sm">
              {skills.slice(0, 8).map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-md py-sm"
                >
                  <div className="flex items-center gap-sm">
                    <ProficiencyDots level={skill.proficiency_level} />
                    <span className="text-sm font-medium">{skill.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {skill.category_display}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ) : skills.length === 0 ? (
          <EmptyState
            title={
              search ? t('pages.skills.emptySearch') : t('pages.skills.emptyState')
            }
            icon={<Brain className="h-10 w-10 text-muted-foreground" />}
          />
        ) : (
          <AnimatePresence>
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {skills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
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
              <div className="flex items-center gap-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <DialogTitle>
                    {editingSkill
                      ? t('pages.skills.editTitle')
                      : t('pages.skills.newTitle')}
                  </DialogTitle>
                  <DialogDescription>
                    {editingSkill
                      ? t('pages.skills.editDesc')
                      : t('pages.skills.newDesc')}
                  </DialogDescription>
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
      </PageContainer>
    </AnimatedPage>
  );
}
