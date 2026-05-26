/* eslint-disable max-lines, react-hooks/incompatible-library */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Edit,
  ExternalLink,
  GraduationCap,
  Layers,
  Loader2,
  Plus,
  Timer,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { formatLocalDate, parseLocalDate } from '@/lib/utils';
import {
  courseModulesService,
  courseLessonsService,
  courseSessionsService,
  coursesService,
} from '@/services/courses-service';
import type {
  Course,
  CourseLessonFormData,
  CourseModule,
  CourseModuleFormData,
  CourseSession,
  CourseSessionFormData,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface CourseDetailModalProps {
  course: Course | null;
  open: boolean;
  onClose: () => void;
  onEdit: (course: Course) => void;
  onDelete: (course: Course) => void;
}

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  not_started: 'outline',
  in_progress: 'default',
  completed: 'secondary',
  paused: 'destructive',
};

function ModuleItem({
  mod,
  ownerId,
  onUpdated,
  onDeleted,
}: {
  mod: CourseModule;
  ownerId: number;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const [editingTitle, setEditingTitle] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState('');

  const { data: lessons = [], refetch: refetchLessons } = useQuery({
    queryKey: ['course-lessons', mod.id],
    queryFn: () => courseLessonsService.getAll({ module: mod.id, page_size: 200 }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const updateMod = useMutation({
    mutationFn: (data: Partial<CourseModuleFormData>) =>
      courseModulesService.patch(mod.id, data),
    onSuccess: () => {
      setIsEditing(false);
      onUpdated();
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });

  const deleteMod = useMutation({
    mutationFn: () => courseModulesService.delete(mod.id),
    onSuccess: () => {
      toast({ title: t('pages.courses.modules.deleted') });
      onDeleted();
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });

  const addLesson = useMutation({
    mutationFn: (data: CourseLessonFormData) => courseLessonsService.create(data),
    onSuccess: () => {
      setShowAddLesson(false);
      setNewLessonTitle('');
      void refetchLessons();
      onUpdated();
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });

  const toggleLesson = useMutation({
    mutationFn: (id: number) => coursesService.toggleLesson(id),
    onSuccess: () => {
      void refetchLessons();
      onUpdated();
    },
    onError: () =>
      toast({ title: t('pages.courses.lessons.toggleError'), variant: 'destructive' }),
  });

  const deleteLesson = useMutation({
    mutationFn: (id: number) => courseLessonsService.delete(id),
    onSuccess: () => {
      void refetchLessons();
      onUpdated();
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });

  const completedCount = lessons.filter((l) => l.is_completed).length;

  return (
    <div className="rounded-lg border border-border bg-card p-md">
      <div className="flex items-start justify-between gap-sm">
        <div className="flex min-w-0 flex-1 items-center gap-sm">
          <Layers className="mt-0.5 h-4 w-4 shrink-0 text-category-intellect" />
          {isEditing ? (
            <div className="flex flex-1 gap-sm">
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                className="h-7 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-sm"
                onClick={() => updateMod.mutate({ title: editingTitle })}
                disabled={updateMod.isPending}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <span className="truncate text-sm font-medium">{mod.title}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-xs">
          <span className="text-xs text-muted-foreground">
            {completedCount}/{lessons.length}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => {
              setEditingTitle(mod.title);
              setIsEditing(!isEditing);
            }}
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => {
              void showConfirm({
                title: t('common.messages.confirmDeleteTitle'),
                description: mod.title,
              }).then((ok) => {
                if (ok) deleteMod.mutate();
              });
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {lessons.length > 0 && (
        <Progress
          value={(completedCount / lessons.length) * 100}
          className="mt-sm h-1"
        />
      )}

      <div className="mt-sm space-y-xs">
        {lessons.map((lesson) => (
          <div
            key={lesson.id}
            className="flex items-center justify-between gap-sm rounded px-sm py-xs transition-colors hover:bg-muted/40"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-sm"
              onClick={() => toggleLesson.mutate(lesson.id)}
            >
              {lesson.is_completed ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-category-intellect" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              )}
              <span
                className={`truncate text-sm ${
                  lesson.is_completed
                    ? 'text-muted-foreground line-through'
                    : 'text-foreground'
                }`}
              >
                {lesson.title}
              </span>
            </button>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => {
                void showConfirm({
                  title: t('common.messages.confirmDeleteTitle'),
                  description: lesson.title,
                }).then((ok) => {
                  if (ok) deleteLesson.mutate(lesson.id);
                });
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}

        {showAddLesson ? (
          <div className="flex gap-sm pt-xs">
            <Input
              value={newLessonTitle}
              onChange={(e) => setNewLessonTitle(e.target.value)}
              placeholder={t('pages.courses.lessons.titlePlaceholder')}
              className="h-7 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLessonTitle.trim()) {
                  addLesson.mutate({
                    module: mod.id,
                    title: newLessonTitle.trim(),
                    order: lessons.length + 1,
                    owner: ownerId,
                  });
                }
                if (e.key === 'Escape') setShowAddLesson(false);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-sm"
              onClick={() => {
                if (newLessonTitle.trim()) {
                  addLesson.mutate({
                    module: mod.id,
                    title: newLessonTitle.trim(),
                    order: lessons.length + 1,
                    owner: ownerId,
                  });
                }
              }}
              disabled={addLesson.isPending}
            >
              {addLesson.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-xs rounded px-sm py-xs text-xs text-muted-foreground transition-colors hover:bg-category-intellect/5 hover:text-category-intellect"
            onClick={() => setShowAddLesson(true)}
          >
            <Plus className="h-3 w-3" />
            {t('pages.courses.lessons.newBtn')}
          </button>
        )}
      </div>
    </div>
  );
}

function SessionItem({
  session,
  onDeleted,
}: {
  session: CourseSession;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const deleteSession = useMutation({
    mutationFn: () => courseSessionsService.delete(session.id),
    onSuccess: () => {
      toast({ title: t('pages.courses.sessions.deleted') });
      onDeleted();
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });

  return (
    <div className="flex items-center justify-between gap-sm rounded-lg border border-border bg-card p-sm">
      <div className="flex min-w-0 flex-1 items-center gap-sm">
        <Timer className="h-4 w-4 shrink-0 text-category-intellect" />
        <div className="min-w-0">
          <div className="text-sm font-medium">{formatDate(session.session_date)}</div>
          {session.notes && (
            <div className="truncate text-xs text-muted-foreground">
              {session.notes}
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-sm">
        <span className="rounded bg-category-intellect/10 px-sm py-xs text-xs font-semibold text-category-intellect">
          {session.duration_hours}h
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => {
            void showConfirm({
              title: t('common.messages.confirmDeleteTitle'),
              description: formatDate(session.session_date),
            }).then((ok) => {
              if (ok) deleteSession.mutate();
            });
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function AddSessionForm({
  courseId,
  ownerId,
  onSaved,
  onCancel,
}: {
  courseId: number;
  ownerId: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { register, handleSubmit, setValue, watch } = useForm<{
    session_date: string;
    duration_minutes: number;
    notes: string;
  }>({
    defaultValues: {
      session_date: formatLocalDate(new Date()),
      duration_minutes: 60,
      notes: '',
    },
  });

  const create = useMutation({
    mutationFn: (data: CourseSessionFormData) => courseSessionsService.create(data),
    onSuccess: () => {
      toast({ title: t('pages.courses.sessions.saved') });
      onSaved();
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });

  const onSubmit = (values: {
    session_date: string;
    duration_minutes: number;
    notes: string;
  }) => {
    create.mutate({
      course: courseId,
      session_date: values.session_date,
      duration_minutes: Number(values.duration_minutes),
      notes: values.notes || null,
      owner: ownerId,
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-md rounded-lg border border-category-intellect/20 bg-category-intellect/5 p-md"
    >
      <div className="grid grid-cols-2 gap-md">
        <div className="space-y-xs">
          <Label className="text-xs">{t('pages.courses.sessions.dateLabel')}</Label>
          <DatePicker
            value={parseLocalDate(watch('session_date'))}
            onChange={(d) =>
              setValue(
                'session_date',
                d ? formatLocalDate(d) : formatLocalDate(new Date())
              )
            }
          />
        </div>
        <div className="space-y-xs">
          <Label className="text-xs" htmlFor="duration_minutes">
            {t('pages.courses.sessions.durationLabel')}
          </Label>
          <Input
            id="duration_minutes"
            type="number"
            min={1}
            placeholder={t('pages.courses.sessions.durationPlaceholder')}
            {...register('duration_minutes')}
          />
        </div>
      </div>
      <div className="space-y-xs">
        <Label className="text-xs" htmlFor="session_notes">
          {t('pages.courses.sessions.notesLabel')}
        </Label>
        <Textarea
          id="session_notes"
          rows={2}
          placeholder={t('pages.courses.sessions.notesPlaceholder')}
          {...register('notes')}
        />
      </div>
      <div className="flex justify-end gap-sm">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={create.isPending}
          className="bg-category-intellect text-white hover:bg-category-intellect/90"
        >
          {create.isPending ? (
            <Loader2 className="mr-xs h-3.5 w-3.5 animate-spin" />
          ) : null}
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}

export function CourseDetailModal({
  course,
  open,
  onClose,
  onEdit,
  onDelete,
}: CourseDetailModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddModule, setShowAddModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [showAddSession, setShowAddSession] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);

  const { data: modules = [], refetch: refetchModules } = useQuery({
    queryKey: ['course-modules', course?.id],
    queryFn: () => courseModulesService.getAll({ course: course!.id, page_size: 200 }),
    enabled: !!course && open,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: sessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ['course-sessions', course?.id],
    queryFn: () => courseSessionsService.getAll({ course: course!.id, page_size: 200 }),
    enabled: !!course && open,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: freshCourse, refetch: refetchCourse } = useQuery({
    queryKey: ['course', course?.id],
    queryFn: () => coursesService.getById(course!.id),
    enabled: !!course && open,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const displayCourse = freshCourse ?? course;

  const addModule = useMutation({
    mutationFn: (data: CourseModuleFormData) => courseModulesService.create(data),
    onSuccess: () => {
      setShowAddModule(false);
      setNewModuleTitle('');
      void refetchModules();
      void refetchCourse();
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  const handleModuleUpdated = () => {
    void refetchModules();
    void refetchCourse();
    void queryClient.invalidateQueries({ queryKey: ['courses'] });
  };

  const handleCertificateUpload = async (file: File) => {
    if (!displayCourse) return;
    setUploadingCert(true);
    try {
      const form = new FormData();
      form.append('completion_certificate', file);
      await coursesService.patch(displayCourse.id, form as unknown as Partial<never>);
      void refetchCourse();
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast({ title: t('pages.courses.certificate.uploaded') });
    } catch {
      toast({
        title: t('pages.courses.certificate.uploadError'),
        variant: 'destructive',
      });
    } finally {
      setUploadingCert(false);
    }
  };

  const handleCertificateRemove = async () => {
    if (!displayCourse) return;
    setUploadingCert(true);
    try {
      const form = new FormData();
      form.append('completion_certificate', '');
      await coursesService.patch(displayCourse.id, form as unknown as Partial<never>);
      void refetchCourse();
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast({ title: t('pages.courses.certificate.removed') });
    } catch {
      toast({
        title: t('pages.courses.certificate.uploadError'),
        variant: 'destructive',
      });
    } finally {
      setUploadingCert(false);
    }
  };

  const handleSessionUpdated = () => {
    void refetchSessions();
    void refetchCourse();
    void queryClient.invalidateQueries({ queryKey: ['courses'] });
  };

  const totalSessionHours = sessions.reduce((sum, s) => sum + s.duration_hours, 0);

  if (!displayCourse) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
        {/* Colored header */}
        <div className="bg-category-intellect/10 px-xl pb-md pt-xl">
          <DialogHeader>
            <div className="flex items-start justify-between gap-md">
              <div className="flex min-w-0 flex-1 items-center gap-md">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-category-intellect/20">
                  <GraduationCap className="h-5 w-5 text-category-intellect" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg font-bold">
                    {displayCourse.title}
                  </DialogTitle>
                  <DialogDescription className="mt-xs flex items-center gap-sm">
                    <span>{displayCourse.platform_display}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{displayCourse.category_display}</span>
                  </DialogDescription>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[displayCourse.status] ?? 'outline'}>
                {displayCourse.status_display}
              </Badge>
            </div>

            {/* Progress bar */}
            <div className="mt-md">
              <div className="mb-xs flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('pages.courses.stats.progress')}</span>
                <span className="font-semibold text-category-intellect">
                  {displayCourse.progress_percentage}%
                </span>
              </div>
              <Progress
                value={displayCourse.progress_percentage}
                className="h-2 bg-category-intellect/20"
              />
            </div>

            {/* Stats row */}
            <div className="mt-md grid grid-cols-3 gap-sm">
              <div className="rounded-lg bg-background/60 p-sm text-center">
                <div className="text-lg font-bold text-category-intellect">
                  {displayCourse.completed_lessons}/{displayCourse.total_lessons}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('pages.courses.stats.lessons')}
                </div>
              </div>
              <div className="rounded-lg bg-background/60 p-sm text-center">
                <div className="text-lg font-bold text-category-intellect">
                  {displayCourse.invested_hours.toFixed(1)}h
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('pages.courses.stats.investedHours')}
                </div>
              </div>
              <div className="rounded-lg bg-background/60 p-sm text-center">
                <div className="text-lg font-bold text-category-intellect">
                  {displayCourse.estimated_hours
                    ? `${displayCourse.estimated_hours}h`
                    : '—'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('pages.courses.stats.estimatedHours')}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-md flex gap-sm">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-xs"
              onClick={() => onEdit(displayCourse)}
            >
              <Edit className="h-3.5 w-3.5" />
              {t('common.actions.edit')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-xs text-destructive hover:text-destructive"
              onClick={() => onDelete(displayCourse)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('common.actions.delete')}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="modules" className="p-xl pt-md">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">
              <BookOpen className="mr-xs h-4 w-4" />
              {t('pages.courses.tabs.overview')}
            </TabsTrigger>
            <TabsTrigger value="modules" className="flex-1">
              <Layers className="mr-xs h-4 w-4" />
              {t('pages.courses.tabs.modules')}
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex-1">
              <Timer className="mr-xs h-4 w-4" />
              {t('pages.courses.tabs.sessions')}
            </TabsTrigger>
            <TabsTrigger value="certificate" className="flex-1">
              <Award className="mr-xs h-4 w-4" />
              {t('pages.courses.tabs.certificate')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-md space-y-md">
            {displayCourse.description && (
              <div className="rounded-lg bg-muted/30 p-md text-sm leading-relaxed text-muted-foreground">
                {displayCourse.description}
              </div>
            )}
            {displayCourse.url && (
              <a
                href={displayCourse.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-sm text-sm text-category-intellect hover:underline"
              >
                <GraduationCap className="h-4 w-4" />
                {displayCourse.url}
              </a>
            )}
            <div className="grid grid-cols-2 gap-sm text-sm">
              {displayCourse.start_date && (
                <div className="flex items-center gap-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(displayCourse.start_date)}
                </div>
              )}
              {displayCourse.end_date && (
                <div className="flex items-center gap-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(displayCourse.end_date)}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="modules" className="mt-md space-y-sm">
            {modules.length === 0 && !showAddModule && (
              <div className="rounded-lg border border-dashed border-category-intellect/30 bg-category-intellect/5 p-lg text-center">
                <Layers className="mx-auto mb-sm h-8 w-8 text-category-intellect/40" />
                <p className="text-sm font-medium text-foreground">
                  {t('pages.courses.modules.emptyTitle')}
                </p>
                <p className="mt-xs text-xs text-muted-foreground">
                  {t('pages.courses.modules.emptyHint')}
                </p>
              </div>
            )}

            {modules.map((mod) => (
              <ModuleItem
                key={mod.id}
                mod={mod}
                ownerId={displayCourse.owner}
                onUpdated={handleModuleUpdated}
                onDeleted={handleModuleUpdated}
              />
            ))}

            {showAddModule ? (
              <div className="flex gap-sm">
                <Input
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  placeholder={t('pages.courses.modules.titlePlaceholder')}
                  className="text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newModuleTitle.trim()) {
                      addModule.mutate({
                        course: displayCourse.id,
                        title: newModuleTitle.trim(),
                        order: modules.length + 1,
                        owner: displayCourse.owner,
                      });
                    }
                    if (e.key === 'Escape') setShowAddModule(false);
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    if (newModuleTitle.trim()) {
                      addModule.mutate({
                        course: displayCourse.id,
                        title: newModuleTitle.trim(),
                        order: modules.length + 1,
                        owner: displayCourse.owner,
                      });
                    }
                  }}
                  disabled={addModule.isPending}
                >
                  {addModule.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full gap-sm border-dashed text-muted-foreground hover:border-category-intellect/50 hover:text-category-intellect"
                onClick={() => setShowAddModule(true)}
              >
                <Plus className="h-4 w-4" />
                {t('pages.courses.modules.newBtn')}
              </Button>
            )}
          </TabsContent>

          <TabsContent value="sessions" className="mt-md space-y-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('pages.courses.sessions.totalHours', {
                  hours: totalSessionHours.toFixed(1),
                })}
              </span>
              <Button
                size="sm"
                className="gap-xs bg-category-intellect text-white hover:bg-category-intellect/90"
                onClick={() => setShowAddSession(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('pages.courses.sessions.newBtn')}
              </Button>
            </div>

            {showAddSession && (
              <AddSessionForm
                courseId={displayCourse.id}
                ownerId={displayCourse.owner}
                onSaved={() => {
                  setShowAddSession(false);
                  handleSessionUpdated();
                }}
                onCancel={() => setShowAddSession(false)}
              />
            )}

            {sessions.length === 0 && !showAddSession ? (
              <p className="py-md text-center text-sm text-muted-foreground">
                {t('pages.courses.sessions.emptyState')}
              </p>
            ) : (
              sessions.map((s) => (
                <SessionItem key={s.id} session={s} onDeleted={handleSessionUpdated} />
              ))
            )}
          </TabsContent>

          <TabsContent value="certificate" className="mt-md space-y-md">
            {displayCourse.completion_certificate ? (
              <div className="space-y-md">
                <div className="flex items-center gap-md rounded-lg border border-category-intellect/20 bg-category-intellect/5 p-md">
                  <Award className="h-8 w-8 shrink-0 text-category-intellect" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {t('pages.courses.certificate.fileLabel')}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {displayCourse.completion_certificate.split('/').pop()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-xs">
                    <a
                      href={displayCourse.completion_certificate}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      disabled={uploadingCert}
                      onClick={() => void handleCertificateRemove()}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-destructive transition-colors hover:bg-destructive/10"
                    >
                      {uploadingCert ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <label className="flex cursor-pointer flex-col items-center gap-sm rounded-lg border border-dashed border-border p-md text-center transition-colors hover:bg-muted/30">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {t('pages.courses.certificate.replace')}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleCertificateUpload(file);
                    }}
                  />
                </label>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-md rounded-lg border border-dashed border-category-intellect/30 bg-category-intellect/5 p-xl text-center transition-colors hover:bg-category-intellect/10">
                {uploadingCert ? (
                  <Loader2 className="h-10 w-10 animate-spin text-category-intellect/50" />
                ) : (
                  <Award className="h-10 w-10 text-category-intellect/40" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t('pages.courses.certificate.emptyTitle')}
                  </p>
                  <p className="mt-xs text-xs text-muted-foreground">
                    {t('pages.courses.certificate.emptyHint')}
                  </p>
                </div>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleCertificateUpload(file);
                  }}
                />
              </label>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
