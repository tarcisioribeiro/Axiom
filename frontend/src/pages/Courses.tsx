/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Layers,
  Plus,
  Search,
  Timer,
  Trash2,
  Edit,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { CourseDetailModal } from '@/components/library/CourseDetailModal';
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
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { PLATFORM_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cardVariants } from '@/lib/animations';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { coursesService } from '@/services/courses-service';
import { membersService } from '@/services/members-service';
import type { Course, CourseFormData, CourseStatus } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const STATUS_FILTER_KEYS: (CourseStatus | 'all')[] = [
  'all',
  'in_progress',
  'not_started',
  'completed',
  'paused',
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
}: {
  course: Course;
  onOpen: (c: Course) => void;
  onEdit: (c: Course) => void;
  onDelete: (c: Course) => void;
}) {
  const { t } = useTranslation();

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className="group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
      onClick={() => onOpen(course)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen(course);
      }}
    >
      {/* Header band */}
      <div className="flex items-center gap-sm bg-primary/10 px-md pb-sm pt-md">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20">
          {(() => {
            const PlatformIcon =
              PLATFORM_ICONS[course.platform] ?? PLATFORM_ICONS['other'];
            return <PlatformIcon className="h-5 w-5 text-primary" />;
          })()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{course.title}</p>
          <p className="text-xs text-muted-foreground">{course.platform_display}</p>
        </div>
        <Badge variant={STATUS_BADGE[course.status]} className="shrink-0 text-xs">
          {course.status_display}
        </Badge>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-sm px-md py-sm">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-xs">
            <Layers className="h-3.5 w-3.5" />
            {course.completed_lessons}/{course.total_lessons}{' '}
            {t('pages.courses.stats.lessons').toLowerCase()}
          </span>
          <span className="flex items-center gap-xs">
            <Timer className="h-3.5 w-3.5" />
            {course.invested_hours.toFixed(1)}h
          </span>
        </div>

        <div>
          <div className="mb-xs flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {t('pages.courses.stats.progress')}
            </span>
            <span className="font-semibold text-primary">
              {course.progress_percentage}%
            </span>
          </div>
          <Progress
            value={course.progress_percentage}
            className="h-1.5 bg-primary/20"
          />
        </div>

        <Badge variant="outline" className="w-fit text-xs">
          {course.category_display}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex gap-xs border-t border-border/50 px-md py-sm opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 flex-1 gap-xs text-xs"
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
          className="h-7 flex-1 gap-xs text-xs text-destructive hover:text-destructive"
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

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CourseStatus | 'all'>('all');
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
  if (search) params.search = search;

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses', statusFilter, search],
    queryFn: () => coursesService.getAll(params),
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

  const inProgressCount = courses.filter((c) => c.status === 'in_progress').length;
  const completedCount = courses.filter((c) => c.status === 'completed').length;
  const totalHours = courses.reduce((s, c) => s + c.invested_hours, 0);

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('pages.courses.title')}
          subtitle={t('pages.courses.subtitle')}
          icon={<GraduationCap className="h-6 w-6 text-primary" />}
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

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-md">
          {[
            {
              label: t('pages.courses.filters.in_progress'),
              value: inProgressCount,
              icon: BookOpen,
            },
            {
              label: t('pages.courses.filters.completed'),
              value: completedCount,
              icon: CheckCircle2,
            },
            {
              label: t('pages.courses.stats.investedHours'),
              value: `${totalHours.toFixed(1)}h`,
              icon: Clock,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center gap-md rounded-lg border border-border bg-card p-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t('pages.courses.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-xs">
            {STATUS_FILTER_KEYS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-lg px-md py-xs text-xs font-medium transition-colors',
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {s === 'all'
                  ? t('pages.courses.filters.all')
                  : t(`pages.courses.filters.${s}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <LoadingState />
        ) : courses.length === 0 ? (
          <EmptyState
            title={
              search ? t('pages.courses.emptySearch') : t('pages.courses.emptyState')
            }
            icon={<GraduationCap className="h-10 w-10 text-muted-foreground" />}
          />
        ) : (
          <AnimatePresence>
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onOpen={(c) => {
                    setDetailCourse(c);
                    setDetailOpen(true);
                  }}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
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
              <div className="flex items-center gap-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <DialogTitle>
                    {editingCourse
                      ? t('pages.courses.editTitle')
                      : t('pages.courses.newTitle')}
                  </DialogTitle>
                  <DialogDescription>
                    {editingCourse
                      ? t('pages.courses.editDesc')
                      : t('pages.courses.newDesc')}
                  </DialogDescription>
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
