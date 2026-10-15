/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  CircleDot,
  GraduationCap,
  Layers,
  MonitorPlay,
  Plus,
  Search,
  Tag,
  Timer,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { CardActions } from '@/components/common/CardActions';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import {
  CourseCertificateModal,
  CourseDetailModal,
  CourseModulesModal,
  CourseSessionsModal,
} from '@/components/library/CourseDetailModal';
import { CourseForm } from '@/components/library/CourseForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import {
  COURSE_STATUS_ICONS,
  PLATFORM_ICONS,
  SKILL_CATEGORY_ICONS,
} from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cardVariants } from '@/lib/animations';
import { STALE_TIMES } from '@/lib/query-client';
import { coursesService } from '@/services/courses-service';
import { membersService } from '@/services/members-service';
import type {
  Course,
  CourseFormData,
  CoursePlatform,
  CourseStatus,
  IntellectCategory,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const STATUS_FILTER_KEYS: (CourseStatus | 'all')[] = [
  'all',
  'in_progress',
  'not_started',
  'completed',
  'paused',
];

const CATEGORY_FILTER_KEYS: (IntellectCategory | 'all')[] = [
  'all',
  'technology',
  'languages',
  'design',
  'business',
  'science',
  'arts',
  'other',
];

const PLATFORM_FILTER_KEYS: (CoursePlatform | 'all')[] = [
  'all',
  'udemy',
  'coursera',
  'youtube',
  'linkedin',
  'alura',
  'pluralsight',
  'other',
];

const STATUS_BADGE: Record<
  CourseStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  not_started: 'outline',
  in_progress: 'default',
  completed: 'secondary',
  paused: 'destructive',
};

type CourseAction = 'modules' | 'sessions' | 'certificate';

/**
 * Card de grade (§5): ícone da plataforma + título + plataforma (1 linha) +
 * progresso (métrica) + status. Aulas, horas e categoria ficam no detalhe.
 */
function CourseCard({
  course,
  onOpen,
  onEdit,
  onDelete,
  onAction,
  onAskIntellect,
}: {
  course: Course;
  onOpen: (c: Course) => void;
  onEdit: (c: Course) => void;
  onDelete: (c: Course) => void;
  onAction: (c: Course, action: CourseAction) => void;
  onAskIntellect: (c: Course) => void;
}) {
  const { t } = useTranslation();
  const PlatformIcon = PLATFORM_ICONS[course.platform] ?? PLATFORM_ICONS['other'];
  const StatusIcon = COURSE_STATUS_ICONS[course.status];

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className="border-border bg-card flex cursor-pointer flex-col rounded-lg border"
      onClick={() => onOpen(course)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen(course);
      }}
    >
      <div className="gap-sm px-md py-sm flex flex-1 items-center">
        <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <PlatformIcon className="text-primary h-5 w-5" />
        </div>
        <div className="space-y-xs min-w-0 flex-1">
          <div className="gap-sm flex items-start justify-between">
            <p className="truncate text-sm font-semibold" title={course.title}>
              {course.title}
            </p>
            <Badge
              variant={STATUS_BADGE[course.status]}
              className="gap-xs shrink-0 text-xs"
            >
              {StatusIcon && <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />}
              {t(`pages.courses.status.${course.status}`)}
            </Badge>
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {t(`pages.courses.platform.${course.platform}`)}
          </p>
          <div className="gap-sm flex items-center">
            <Progress value={course.progress_percentage} className="h-1.5 flex-1" />
            <span className="text-muted-foreground text-xs">
              {course.progress_percentage}%
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
          onEdit={() => onEdit(course)}
          onDelete={() => onDelete(course)}
          menuActions={[
            {
              icon: Layers,
              label: t('pages.courses.modulesAndLessons'),
              onClick: () => onAction(course, 'modules'),
              color: 'plan',
            },
            {
              icon: Timer,
              label: t('pages.courses.sessions.title'),
              onClick: () => onAction(course, 'sessions'),
              color: 'progress',
            },
            {
              icon: Award,
              label: t('pages.courses.tabs.certificate'),
              onClick: () => onAction(course, 'certificate'),
              color: 'preview',
            },
            {
              icon: Brain,
              label: t('pages.courses.askIntellect'),
              onClick: () => onAskIntellect(course),
              color: 'chat',
            },
          ]}
        />
      </div>
    </motion.div>
  );
}

export default function Courses() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CourseStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<IntellectCategory | 'all'>(
    'all'
  );
  const [platformFilter, setPlatformFilter] = useState<CoursePlatform | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionModal, setActionModal] = useState<{
    course: Course;
    action: CourseAction;
  } | null>(null);

  const { data: member } = useQuery({
    queryKey: ['member-me'],
    queryFn: () => membersService.getCurrentUserMember(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const params: Record<string, unknown> = {};
  if (statusFilter !== 'all') params.status = statusFilter;
  if (categoryFilter !== 'all') params.category = categoryFilter;
  if (platformFilter !== 'all') params.platform = platformFilter;
  if (search) params.search = search;

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses', statusFilter, categoryFilter, platformFilter, search],
    queryFn: () => coursesService.getAllPages(params),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['courses'] });

  const createMutation = useMutation({
    mutationFn: (data: CourseFormData) => coursesService.create(data),
    onSuccess: () => {
      toast({ title: t('pages.courses.saved') });
      setFormOpen(false);
      setEditingCourse(null);
      void invalidate();
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CourseFormData }) =>
      coursesService.update(id, data),
    onSuccess: () => {
      toast({ title: t('pages.courses.updated') });
      setFormOpen(false);
      setEditingCourse(null);
      void invalidate();
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => coursesService.delete(id),
    onSuccess: () => {
      toast({ title: t('pages.courses.deleted') });
      void invalidate();
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });

  const handleSubmit = async (data: CourseFormData) => {
    if (editingCourse) {
      await updateMutation.mutateAsync({ id: editingCourse.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleDelete = (course: Course) => {
    void showConfirm({
      title: t('common.messages.confirmDeleteTitle'),
      description: t('pages.courses.deleteConfirm', { title: course.title }),
    }).then((ok) => {
      if (ok) deleteMutation.mutate(course.id);
    });
  };

  const handleEdit = (course: Course) => {
    setDetailOpen(false);
    setEditingCourse(course);
    setFormOpen(true);
  };

  const openNew = () => {
    setEditingCourse(null);
    setFormOpen(true);
  };

  const handleAskIntellect = (course: Course) => {
    const context = encodeURIComponent(
      t('pages.courses.agentContext', { title: course.title })
    );
    void navigate(`/agents?context=${context}`);
  };

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('pages.courses.title')}
          icon={<GraduationCap className="text-primary h-6 w-6" />}
          actions={
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" />
              {t('pages.courses.newBtn')}
            </Button>
          }
        />

        {/* Filters */}
        <FilterBar
          hasActiveFilters={
            !!search ||
            statusFilter !== 'all' ||
            categoryFilter !== 'all' ||
            platformFilter !== 'all'
          }
          onClear={() => {
            setSearch('');
            setStatusFilter('all');
            setCategoryFilter('all');
            setPlatformFilter('all');
          }}
          activeFilters={[
            ...(statusFilter !== 'all'
              ? [
                  {
                    key: 'status',
                    label: `${t('common.fields.status')}: ${t(`pages.courses.filters.${statusFilter}`)}`,
                    onRemove: () => setStatusFilter('all'),
                  },
                ]
              : []),
            ...(categoryFilter !== 'all'
              ? [
                  {
                    key: 'category',
                    label: `${t('common.fields.category')}: ${t(`pages.courses.category.${categoryFilter}`)}`,
                    onRemove: () => setCategoryFilter('all'),
                  },
                ]
              : []),
            ...(platformFilter !== 'all'
              ? [
                  {
                    key: 'platform',
                    label: `${t('pages.courses.form.platformLabel')}: ${t(`pages.courses.platform.${platformFilter}`)}`,
                    onRemove: () => setPlatformFilter('all'),
                  },
                ]
              : []),
          ]}
        >
          <FilterField label={t('common.filterLabels.search')} icon={Search}>
            <SearchInput
              placeholder={t('pages.courses.searchPlaceholder')}
              value={search}
              onValueChange={setSearch}
            />
          </FilterField>
          <FilterField label={t('common.fields.status')} icon={CheckCircle2}>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as CourseStatus | 'all')}
            >
              <SelectTrigger
                aria-label={t('common.fields.status')}
                startIcon={<CircleDot className="h-3.5 w-3.5" />}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_KEYS.map((s) => {
                  const StatusIcon = COURSE_STATUS_ICONS[s];
                  return (
                    <SelectItem
                      key={s}
                      value={s}
                      icon={StatusIcon ? <StatusIcon className="h-4 w-4" /> : undefined}
                    >
                      {t(`pages.courses.filters.${s}`)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label={t('common.fields.category')} icon={Tag}>
            <Select
              value={categoryFilter}
              onValueChange={(v) => setCategoryFilter(v as IntellectCategory | 'all')}
            >
              <SelectTrigger
                aria-label={t('pages.courses.allCategories')}
                startIcon={<Tag className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.courses.allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.courses.allCategories')}</SelectItem>
                {CATEGORY_FILTER_KEYS.filter((c) => c !== 'all').map((c) => {
                  const CategoryIcon = SKILL_CATEGORY_ICONS[c];
                  return (
                    <SelectItem
                      key={c}
                      value={c}
                      icon={
                        CategoryIcon ? <CategoryIcon className="h-4 w-4" /> : undefined
                      }
                    >
                      {t(`pages.courses.category.${c}`)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label={t('common.filterLabels.platform')} icon={MonitorPlay}>
            <Select
              value={platformFilter}
              onValueChange={(v) => setPlatformFilter(v as CoursePlatform | 'all')}
            >
              <SelectTrigger
                aria-label={t('pages.courses.allPlatforms')}
                startIcon={<BookOpen className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.courses.allPlatforms')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.courses.allPlatforms')}</SelectItem>
                {PLATFORM_FILTER_KEYS.filter((p) => p !== 'all').map((p) => {
                  const PlatformIcon = PLATFORM_ICONS[p];
                  return (
                    <SelectItem
                      key={p}
                      value={p}
                      icon={
                        PlatformIcon ? <PlatformIcon className="h-4 w-4" /> : undefined
                      }
                    >
                      {t(`pages.courses.platform.${p}`)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FilterField>
        </FilterBar>

        {/* Grid */}
        {isLoading ? (
          <LoadingState />
        ) : courses.length === 0 ? (
          <EmptyState
            title={
              search ? t('pages.courses.emptySearch') : t('pages.courses.emptyState')
            }
            icon={<GraduationCap className="text-muted-foreground h-10 w-10" />}
          />
        ) : (
          <AnimatePresence>
            <PaginatedSlide
              key={`${statusFilter}-${categoryFilter}-${platformFilter}-${search}`}
              items={courses}
              pageSize={GRID_PAGE_SIZE}
              className="gap-md grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
            >
              {(pageItems) =>
                pageItems.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onOpen={(c) => {
                      setDetailCourse(c);
                      setDetailOpen(true);
                    }}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onAction={(c, action) => setActionModal({ course: c, action })}
                    onAskIntellect={handleAskIntellect}
                  />
                ))
              }
            </PaginatedSlide>
          </AnimatePresence>
        )}

        {/* Course Form Dialog */}
        <Dialog
          open={formOpen}
          onOpenChange={(v) => {
            if (!v) {
              setFormOpen(false);
              setEditingCourse(null);
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle mode={editingCourse ? 'edit' : 'create'}>
                {editingCourse
                  ? t('pages.courses.editTitle')
                  : t('pages.courses.newTitle')}
              </DialogTitle>
              <VisuallyHidden>
                <DialogDescription>
                  {editingCourse
                    ? t('pages.courses.editDesc')
                    : t('pages.courses.newDesc')}
                </DialogDescription>
              </VisuallyHidden>
            </DialogHeader>
            <CourseForm
              course={editingCourse ?? undefined}
              ownerId={member?.id ?? 0}
              onSubmit={handleSubmit}
              onCancel={() => {
                setFormOpen(false);
                setEditingCourse(null);
              }}
              isLoading={createMutation.isPending || updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Course Detail Modal */}
        <CourseDetailModal
          course={detailCourse}
          open={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setDetailCourse(null);
          }}
        />
        <CourseModulesModal
          course={actionModal?.course ?? null}
          open={actionModal?.action === 'modules'}
          onClose={() => setActionModal(null)}
        />
        <CourseSessionsModal
          course={actionModal?.course ?? null}
          open={actionModal?.action === 'sessions'}
          onClose={() => setActionModal(null)}
        />
        <CourseCertificateModal
          course={actionModal?.course ?? null}
          open={actionModal?.action === 'certificate'}
          onClose={() => setActionModal(null)}
        />
      </PageContainer>
    </AnimatedPage>
  );
}
