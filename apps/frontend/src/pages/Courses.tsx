/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  CircleDot,
  Clock,
  GraduationCap,
  Layers,
  Plus,
  Timer,
  Trash2,
  Edit,
  Brain,
  Tag,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import { EnhancedTooltip } from '@/components/charts/EnhancedTooltip';
import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { CourseDetailModal } from '@/components/library/CourseDetailModal';
import { CourseForm } from '@/components/library/CourseForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useChartColors } from '@/lib/chart-colors';
import { STALE_TIMES } from '@/lib/query-client';
import { coursesService, courseSessionsService } from '@/services/courses-service';
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

function CourseCard({
  course,
  onOpen,
  onEdit,
  onDelete,
  onAskIntellect,
}: {
  course: Course;
  onOpen: (c: Course) => void;
  onEdit: (c: Course) => void;
  onDelete: (c: Course) => void;
  onAskIntellect: (c: Course) => void;
}) {
  const { t } = useTranslation();

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className="group border-border bg-card flex cursor-pointer flex-col overflow-hidden rounded-lg border transition-colors"
      onClick={() => onOpen(course)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen(course);
      }}
    >
      {/* Header band */}
      <div className="gap-sm bg-primary/10 px-md pb-sm pt-md flex items-center">
        <div className="bg-primary/20 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
          {(() => {
            const PlatformIcon =
              PLATFORM_ICONS[course.platform] ?? PLATFORM_ICONS['other'];
            return <PlatformIcon className="text-primary h-5 w-5" />;
          })()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-tight font-semibold">{course.title}</p>
          <p className="text-muted-foreground text-xs">
            {t(`pages.courses.platform.${course.platform}`)}
          </p>
        </div>
        <Badge
          variant={STATUS_BADGE[course.status]}
          className="gap-xs shrink-0 text-xs"
        >
          {(() => {
            const StatusIcon = COURSE_STATUS_ICONS[course.status];
            return StatusIcon ? (
              <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            ) : null;
          })()}
          {t(`pages.courses.status.${course.status}`)}
        </Badge>
      </div>

      {/* Body */}
      <div className="gap-sm px-md py-sm flex flex-1 flex-col">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span className="gap-xs flex items-center">
            <Layers className="h-3.5 w-3.5" />
            {course.completed_lessons}/{course.total_lessons}{' '}
            {t('pages.courses.stats.lessons').toLowerCase()}
          </span>
          <span className="gap-xs flex items-center">
            <Timer className="h-3.5 w-3.5" />
            {course.invested_hours.toFixed(1)}h
          </span>
        </div>

        <div>
          <div className="mb-xs flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {t('pages.courses.stats.progress')}
            </span>
            <span className="text-primary font-semibold">
              {course.progress_percentage}%
            </span>
          </div>
          <Progress
            value={course.progress_percentage}
            className="bg-primary/20 h-1.5"
          />
        </div>

        <Badge variant="outline" className="w-fit text-xs">
          {t(`pages.courses.category.${course.category}`)}
        </Badge>
      </div>

      {/* Actions */}
      <div className="gap-xs border-border/50 px-md py-sm flex border-t">
        <Button
          size="sm"
          variant="ghost"
          className="gap-xs h-7 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onAskIntellect(course);
          }}
          title={t('pages.courses.askIntellect')}
        >
          <Brain className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-xs h-7 flex-1 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(course);
          }}
        >
          <Edit className="h-3 w-3" />
          {t('common.actions.edit')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-xs text-destructive hover:text-destructive h-7 flex-1 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(course);
          }}
        >
          <Trash2 className="h-3 w-3" />
          {t('common.actions.delete')}
        </Button>
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

  const { data: member } = useQuery({
    queryKey: ['member-me'],
    queryFn: () => membersService.getCurrentUserMember(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const params: Record<string, unknown> = { page_size: 200 };
  if (statusFilter !== 'all') params.status = statusFilter;
  if (categoryFilter !== 'all') params.category = categoryFilter;
  if (platformFilter !== 'all') params.platform = platformFilter;
  if (search) params.search = search;

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses', statusFilter, categoryFilter, platformFilter, search],
    queryFn: () => coursesService.getAll(params),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const weekStart = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  }, []);

  const { data: weekSessions = [] } = useQuery({
    queryKey: ['course-sessions', 'week', weekStart],
    queryFn: () =>
      courseSessionsService
        .getAll({ page_size: 200, session_date__gte: weekStart })
        .then((r) =>
          Array.isArray(r) ? r : ((r as { results: typeof r }).results ?? r)
        ),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const COLORS = useChartColors();

  const weeklyHoursData = useMemo(() => {
    const totals: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const sessions = Array.isArray(weekSessions) ? weekSessions : [];
    sessions.forEach((s) => {
      const d = new Date(s.session_date + 'T00:00:00');
      const dow = (d.getDay() + 6) % 7;
      totals[dow] = (totals[dow] ?? 0) + (s.duration_hours ?? s.duration_minutes / 60);
    });
    return Array.from({ length: 7 }, (_, i) => ({
      name: t(`pages.planningDashboard.weekdayShort.${i}`),
      hours: Number((totals[i] ?? 0).toFixed(1)),
    }));
  }, [weekSessions, t]);

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
    const context = encodeURIComponent(`Curso: ${course.title}`);
    void navigate(`/agents?context=${context}`);
  };

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('pages.courses.title')}
          icon={<GraduationCap className="text-primary h-6 w-6" />}
          actions={
            <Button
              onClick={openNew}
              className="gap-sm bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              {t('pages.courses.newBtn')}
            </Button>
          }
        />

        {/* Study hours this week */}
        <Card>
          <CardHeader className="pb-sm">
            <CardTitle className="gap-sm flex items-center text-sm font-medium">
              <Clock className="text-primary h-4 w-4" />
              {t('pages.courses.studyHours.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart
                data={weeklyHoursData}
                margin={{ top: 4, right: 8, bottom: 0, left: -24 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                  content={
                    <EnhancedTooltip
                      formatter={(value) => `${Number(value)}h`}
                      nameFormatter={() => t('pages.courses.studyHours.hours')}
                    />
                  }
                />
                <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {weeklyHoursData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[0]}
                      fillOpacity={_.hours > 0 ? 1 : 0.25}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-xs text-muted-foreground text-center text-xs">
              {t('pages.courses.studyHours.subtitle')}
            </p>
          </CardContent>
        </Card>

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
          <FilterField label={t('common.filterLabels.search')}>
            <SearchInput
              placeholder={t('pages.courses.searchPlaceholder')}
              value={search}
              onValueChange={setSearch}
            />
          </FilterField>
          <FilterField label={t('common.fields.status')}>
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
          <FilterField label={t('common.fields.category')}>
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
          <FilterField label={t('common.filterLabels.platform')}>
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
              className="gap-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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
              <div className="gap-sm flex items-center">
                <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-lg">
                  <GraduationCap className="text-primary h-4 w-4" />
                </div>
                <div>
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
                </div>
              </div>
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
          onEdit={handleEdit}
          onDelete={(c) => {
            setDetailOpen(false);
            handleDelete(c);
          }}
        />
      </PageContainer>
    </AnimatedPage>
  );
}
