/* eslint-disable max-lines, react-hooks/incompatible-library */
/**
 * Modais do curso (§2): o detalhe (clique no card) é somente leitura; módulos e
 * aulas, sessões de estudo e certificado são modais de ação abertos pelo menu
 * "..." do card.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Calendar,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Circle,
  Eye,
  FileText,
  GraduationCap,
  Layers,
  Link2,
  Pencil,
  PlayCircle,
  Plus,
  Save,
  Square,
  Timer,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
// Configure PDF.js worker via Vite ?url import for reliable asset bundling
// (same setup as BookReader.tsx — safe to register more than once).
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Document, Page, pdfjs } from 'react-pdf';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { EnhancedTooltip } from '@/components/charts/EnhancedTooltip';
import { EmptyState } from '@/components/common/EmptyState';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { API_CONFIG } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { toast } from '@/hooks/use-toast';
import { ACTION_COLOR } from '@/lib/action-colors';
import { notifyFormErrors } from '@/lib/form-errors';
import { formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn, formatLocalDate, parseLocalDate } from '@/lib/utils';
import {
  courseModulesService,
  courseLessonsService,
  courseSessionsService,
  coursesService,
} from '@/services/courses-service';
import type {
  Course,
  CourseLesson,
  CourseModule,
  CourseSessionFormData,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  not_started: 'outline',
  in_progress: 'default',
  completed: 'secondary',
  paused: 'destructive',
};

const errorToast = (err: unknown) =>
  toast({ title: getErrorMessage(err), variant: 'destructive' });

/** Curso atualizado do servidor (progresso e horas mudam com aulas/sessões). */
function useFreshCourse(course: Course | null, enabled: boolean) {
  return useQuery({
    queryKey: ['course', course?.id],
    queryFn: () => coursesService.getById(course!.id),
    enabled: !!course && enabled,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
}

/** Invalida tudo que depende do curso após uma alteração. */
function useInvalidateCourse(courseId: number | undefined) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    void queryClient.invalidateQueries({ queryKey: ['course-modules', courseId] });
    void queryClient.invalidateQueries({ queryKey: ['course-sessions', courseId] });
    void queryClient.invalidateQueries({ queryKey: ['courses'] });
  };
}

function RowIconButton({
  label,
  onClick,
  icon: Icon,
  color,
  disabled,
}: {
  label: string;
  onClick: () => void;
  icon: typeof Pencil;
  color: string;
  disabled?: boolean;
}) {
  return (
    <Button
      aria-label={label}
      size="icon"
      variant="ghost"
      className="h-7 w-7 shrink-0"
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden="true" />
    </Button>
  );
}

// ============================================================================
// DETALHE (somente leitura)
// ============================================================================

interface CourseModalProps {
  course: Course | null;
  open: boolean;
  onClose: () => void;
}

export function CourseDetailModal({ course, open, onClose }: CourseModalProps) {
  const { t } = useTranslation();
  const { data: fresh, isLoading } = useFreshCourse(course, open);
  const c = fresh ?? course;

  return (
    <Dialog open={open && !!c && !isLoading} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        {c && (
          <>
            <DialogHeader>
              <DialogTitle icon={GraduationCap}>
                <span className="truncate">{c.title}</span>
              </DialogTitle>
              <VisuallyHidden>
                <DialogDescription>{t('pages.courses.detailDesc')}</DialogDescription>
              </VisuallyHidden>
            </DialogHeader>

            <div className="gap-sm flex flex-wrap items-center">
              <Badge variant={STATUS_VARIANT[c.status] ?? 'outline'}>
                {t(`pages.courses.status.${c.status}`, {
                  defaultValue: c.status_display,
                })}
              </Badge>
              <Badge variant="secondary">
                {t(`pages.courses.platform.${c.platform}`, {
                  defaultValue: c.platform_display,
                })}
              </Badge>
              <Badge variant="outline">
                {t(`pages.courses.category.${c.category}`, {
                  defaultValue: c.category_display,
                })}
              </Badge>
            </div>

            <div className="space-y-xs">
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>{t('pages.courses.stats.progress')}</span>
                <span className="text-foreground font-semibold">
                  {c.progress_percentage}%
                </span>
              </div>
              <Progress value={c.progress_percentage} className="h-2" />
            </div>

            <div className="gap-sm grid grid-cols-3">
              {[
                {
                  label: t('pages.courses.stats.lessons'),
                  value: `${c.completed_lessons}/${c.total_lessons}`,
                },
                {
                  label: t('pages.courses.stats.investedHours'),
                  value: t('pages.courses.hoursValue', {
                    hours: c.invested_hours.toFixed(1),
                  }),
                },
                {
                  label: t('pages.courses.stats.estimatedHours'),
                  value: c.estimated_hours
                    ? t('pages.courses.hoursValue', { hours: c.estimated_hours })
                    : '—',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="border-border p-sm rounded-lg border text-center"
                >
                  <div className="text-lg font-bold">{stat.value}</div>
                  <div className="text-muted-foreground text-xs">{stat.label}</div>
                </div>
              ))}
            </div>

            {c.description && (
              <p
                className="text-muted-foreground line-clamp-6 text-sm leading-relaxed"
                title={c.description}
              >
                {c.description}
              </p>
            )}

            {(c.url || c.start_date || c.end_date) && (
              <div className="gap-sm grid grid-cols-2 text-sm">
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-xs text-primary col-span-2 flex items-center truncate hover:underline"
                  >
                    <Link2 className="h-4 w-4 shrink-0" />
                    <span className="truncate">{c.url}</span>
                  </a>
                )}
                {c.start_date && (
                  <div className="gap-xs text-muted-foreground flex items-center">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(c.start_date)}
                  </div>
                )}
                {c.end_date && (
                  <div className="gap-xs text-muted-foreground flex items-center">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(c.end_date)}
                  </div>
                )}
              </div>
            )}

            <DialogCloseFooter />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// FORM DE TÍTULO (módulo / aula)
// ============================================================================

function TitleFormDialog({
  open,
  mode,
  dialogTitle,
  fieldLabel,
  placeholder,
  icon: Icon,
  initialValue,
  isLoading,
  onSubmit,
  onClose,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  dialogTitle: string;
  fieldLabel: string;
  placeholder: string;
  icon: typeof Layers;
  initialValue: string;
  isLoading: boolean;
  onSubmit: (title: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const [invalid, setInvalid] = useState(false);
  const [lastInitial, setLastInitial] = useState({ open, initialValue });
  if (lastInitial.open !== open || lastInitial.initialValue !== initialValue) {
    setLastInitial({ open, initialValue });
    setValue(initialValue);
    setInvalid(false);
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setInvalid(true);
      toast({
        title: t('common.fieldRequired', { field: fieldLabel }),
        variant: 'destructive',
      });
      return;
    }
    onSubmit(value.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <form noValidate onSubmit={submit}>
          <DialogHeader>
            <DialogTitle mode={mode}>{dialogTitle}</DialogTitle>
            <VisuallyHidden>
              <DialogDescription>{dialogTitle}</DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <div className="space-y-sm py-md">
            <Label className="gap-xs flex items-center" htmlFor="title-form-value">
              <Icon className="text-muted-foreground h-3.5 w-3.5" />
              {fieldLabel}
            </Label>
            <Input
              id="title-form-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              aria-invalid={invalid}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" loading={isLoading}>
              {!isLoading && <Save className="h-4 w-4" />}
              {t('common.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MÓDULOS E AULAS (ação)
// ============================================================================

export function CourseModulesModal({ course, open, onClose }: CourseModalProps) {
  const { t } = useTranslation();
  const { showConfirm } = useAlertDialog();
  const invalidate = useInvalidateCourse(course?.id);
  const { data: fresh, isLoading: isLoadingCourse } = useFreshCourse(course, open);
  const c = fresh ?? course;

  // Módulos já vêm com as aulas aninhadas (CourseModuleSerializer.lessons).
  const { data: modules = [], isLoading: isLoadingModules } = useQuery({
    queryKey: ['course-modules', course?.id],
    queryFn: () => courseModulesService.getAllPages({ course: course!.id }),
    enabled: !!course && open,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const selectedModule: CourseModule | undefined =
    modules.find((m) => m.id === selectedModuleId) ?? modules[0];
  const lessons: CourseLesson[] = useMemo(
    () => [...(selectedModule?.lessons ?? [])].sort((a, b) => a.order - b.order),
    [selectedModule]
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [moduleForm, setModuleForm] = useState<{
    open: boolean;
    module?: CourseModule;
  }>({
    open: false,
  });
  const [lessonFormOpen, setLessonFormOpen] = useState(false);

  const saveModule = useMutation({
    mutationFn: ({ title, module }: { title: string; module?: CourseModule }) =>
      module
        ? courseModulesService.patch(module.id, { title })
        : courseModulesService.create({
            course: course!.id,
            title,
            order: modules.length + 1,
            owner: course!.owner,
          }),
    onSuccess: (saved, { module }) => {
      toast({
        title: module
          ? t('pages.courses.modules.updated')
          : t('pages.courses.modules.saved'),
      });
      setModuleForm({ open: false });
      if (!module) setSelectedModuleId(saved.id);
      invalidate();
    },
    onError: errorToast,
  });

  const deleteModule = useMutation({
    mutationFn: (id: number) => courseModulesService.delete(id),
    onSuccess: () => {
      toast({ title: t('pages.courses.modules.deleted') });
      setSelectedModuleId(null);
      invalidate();
    },
    onError: errorToast,
  });

  const addLesson = useMutation({
    mutationFn: (title: string) =>
      courseLessonsService.create({
        module: selectedModule.id,
        title,
        order: lessons.length + 1,
        owner: course!.owner,
      }),
    onSuccess: () => {
      toast({ title: t('pages.courses.lessons.saved') });
      setLessonFormOpen(false);
      invalidate();
    },
    onError: errorToast,
  });

  const toggleLesson = useMutation({
    mutationFn: (id: number) => coursesService.toggleLesson(id),
    onSuccess: invalidate,
    onError: () =>
      toast({ title: t('pages.courses.lessons.toggleError'), variant: 'destructive' }),
  });

  const deleteLesson = useMutation({
    mutationFn: (id: number) => courseLessonsService.delete(id),
    onSuccess: () => {
      toast({ title: t('pages.courses.lessons.deleted') });
      invalidate();
    },
    onError: errorToast,
  });

  const bulkComplete = useMutation({
    mutationFn: ({ ids, done }: { ids: number[]; done: boolean }) =>
      courseLessonsService.bulkComplete(ids, done),
    onSuccess: () => {
      setSelectedIds(new Set());
      invalidate();
    },
    onError: errorToast,
  });

  const openNewModule = () => {
    // Regra do backend: carga horária antes dos módulos — aviso em toast (§2.1).
    if (!c?.estimated_hours) {
      toast({
        title: t('pages.courses.modules.needsEstimatedHours'),
        variant: 'destructive',
      });
      return;
    }
    setModuleForm({ open: true });
  };

  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = lessons.length > 0 && selectedIds.size === lessons.length;

  return (
    <>
      <Dialog
        open={open && !!c && !isLoadingCourse && !isLoadingModules}
        onOpenChange={(v) => !v && onClose()}
      >
        <DialogContent className="max-w-xl">
          {c && (
            <>
              <DialogHeader>
                <DialogTitle icon={Layers}>
                  {t('pages.courses.modulesAndLessons')}
                </DialogTitle>
                <VisuallyHidden>
                  <DialogDescription>{c.title}</DialogDescription>
                </VisuallyHidden>
              </DialogHeader>

              {modules.length === 0 || !selectedModule ? (
                <EmptyState
                  title={t('pages.courses.modules.emptyTitle')}
                  icon={<Layers />}
                />
              ) : (
                <div className="space-y-md">
                  <div className="gap-sm flex items-end">
                    <div className="space-y-xs flex-1">
                      <Label className="gap-xs flex items-center">
                        <Layers className="text-muted-foreground h-3.5 w-3.5" />
                        {t('pages.courses.sessions.moduleLabel')}
                      </Label>
                      <Select
                        value={String(selectedModule.id)}
                        onValueChange={(v) => {
                          setSelectedModuleId(Number(v));
                          setSelectedIds(new Set());
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {modules.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>
                              {m.title} ({m.completed_lessons}/{m.total_lessons})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <RowIconButton
                      label={t('common.actions.edit')}
                      icon={Pencil}
                      color={ACTION_COLOR.edit}
                      onClick={() =>
                        setModuleForm({ open: true, module: selectedModule })
                      }
                    />
                    <RowIconButton
                      label={t('common.actions.delete')}
                      icon={Trash2}
                      color={ACTION_COLOR.delete}
                      onClick={() => {
                        void showConfirm({
                          title: t('common.messages.confirmDeleteTitle'),
                          description: selectedModule.title,
                          variant: 'destructive',
                        }).then((ok) => {
                          if (ok) deleteModule.mutate(selectedModule.id);
                        });
                      }}
                    />
                  </div>

                  {lessons.length > 0 && (
                    <Progress
                      value={(selectedModule.completed_lessons / lessons.length) * 100}
                      className="h-1.5"
                    />
                  )}

                  {lessons.length > 0 && (
                    <div className="gap-sm flex items-center justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSelectedIds(
                            allSelected ? new Set() : new Set(lessons.map((l) => l.id))
                          )
                        }
                      >
                        {allSelected ? (
                          <CheckSquare className="text-primary h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                        {t('pages.courses.lessons.selectAll')}
                      </Button>
                      {selectedIds.size > 0 && (
                        <div className="gap-xs flex items-center">
                          <span className="text-muted-foreground text-xs">
                            {selectedIds.size} {t('pages.courses.lessons.selected')}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            loading={bulkComplete.isPending}
                            onClick={() =>
                              bulkComplete.mutate({ ids: [...selectedIds], done: true })
                            }
                          >
                            {!bulkComplete.isPending && (
                              <CheckCircle2 className="text-success h-4 w-4" />
                            )}
                            {t('pages.courses.lessons.markDone')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={bulkComplete.isPending}
                            onClick={() =>
                              bulkComplete.mutate({
                                ids: [...selectedIds],
                                done: false,
                              })
                            }
                          >
                            <Circle className="h-4 w-4" />
                            {t('pages.courses.lessons.markPending')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {lessons.length === 0 ? (
                    <EmptyState
                      title={t('pages.courses.lessons.emptyState')}
                      icon={<PlayCircle />}
                    />
                  ) : (
                    <PaginatedSlide
                      key={selectedModule.id}
                      items={lessons}
                      pageSize={LIST_PAGE_SIZE}
                      pinNav={false}
                      className="space-y-xs"
                    >
                      {(pageLessons) =>
                        pageLessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="gap-sm border-border px-sm py-xs flex items-center rounded-md border"
                          >
                            <RowIconButton
                              label={t('common.actions.select')}
                              icon={selectedIds.has(lesson.id) ? CheckSquare : Square}
                              color={
                                selectedIds.has(lesson.id)
                                  ? 'text-primary'
                                  : 'text-muted-foreground'
                              }
                              onClick={() => toggleSelect(lesson.id)}
                            />
                            <button
                              type="button"
                              className="gap-sm flex min-w-0 flex-1 items-center text-left"
                              onClick={() => toggleLesson.mutate(lesson.id)}
                            >
                              {lesson.is_completed ? (
                                <CheckCircle2 className="text-success h-4 w-4 shrink-0" />
                              ) : (
                                <Circle className="text-muted-foreground h-4 w-4 shrink-0" />
                              )}
                              <span
                                className={cn(
                                  'truncate text-sm',
                                  lesson.is_completed &&
                                    'text-muted-foreground line-through'
                                )}
                              >
                                {lesson.title}
                              </span>
                            </button>
                            <RowIconButton
                              label={t('common.actions.delete')}
                              icon={Trash2}
                              color={ACTION_COLOR.delete}
                              onClick={() => {
                                void showConfirm({
                                  title: t('common.messages.confirmDeleteTitle'),
                                  description: lesson.title,
                                  variant: 'destructive',
                                }).then((ok) => {
                                  if (ok) deleteLesson.mutate(lesson.id);
                                });
                              }}
                            />
                          </div>
                        ))
                      }
                    </PaginatedSlide>
                  )}
                </div>
              )}

              <DialogCloseFooter>
                <Button variant="outline" onClick={openNewModule}>
                  <Plus className="h-4 w-4" />
                  {t('pages.courses.modules.newBtn')}
                </Button>
                {selectedModule && (
                  <Button onClick={() => setLessonFormOpen(true)}>
                    <Plus className="h-4 w-4" />
                    {t('pages.courses.lessons.newBtn')}
                  </Button>
                )}
              </DialogCloseFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <TitleFormDialog
        open={moduleForm.open}
        mode={moduleForm.module ? 'edit' : 'create'}
        dialogTitle={
          moduleForm.module
            ? t('pages.courses.modules.editTitle')
            : t('pages.courses.modules.newTitle')
        }
        fieldLabel={t('pages.courses.modules.titleLabel')}
        placeholder={t('pages.courses.modules.titlePlaceholder')}
        icon={Layers}
        initialValue={moduleForm.module?.title ?? ''}
        isLoading={saveModule.isPending}
        onSubmit={(title) => saveModule.mutate({ title, module: moduleForm.module })}
        onClose={() => setModuleForm({ open: false })}
      />
      <TitleFormDialog
        open={lessonFormOpen}
        mode="create"
        dialogTitle={t('pages.courses.lessons.newTitle')}
        fieldLabel={t('pages.courses.lessons.titleLabel')}
        placeholder={t('pages.courses.lessons.titlePlaceholder')}
        icon={PlayCircle}
        initialValue=""
        isLoading={addLesson.isPending}
        onSubmit={(title) => addLesson.mutate(title)}
        onClose={() => setLessonFormOpen(false)}
      />
    </>
  );
}

// ============================================================================
// SESSÕES DE ESTUDO (ação)
// ============================================================================

export function AddSessionForm({
  course,
  defaultMinutes = 60,
  defaultDate,
  onSaved,
  onCancel,
}: {
  course: Course;
  defaultMinutes?: number;
  defaultDate?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [moduleId, setModuleId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const { control, register, handleSubmit, setValue, watch } = useForm<{
    session_date: string;
    duration_minutes: number;
    notes: string;
  }>({
    defaultValues: {
      session_date: defaultDate ?? formatLocalDate(new Date()),
      duration_minutes: defaultMinutes,
      notes: '',
    },
  });

  // Módulos já vêm com as aulas aninhadas (CourseModuleSerializer.lessons).
  const { data: modules = [] } = useQuery({
    queryKey: ['course-modules', course.id],
    queryFn: () => courseModulesService.getAllPages({ course: course.id }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
  const pendingLessons = (
    modules.find((m) => String(m.id) === moduleId)?.lessons ?? []
  ).filter((l) => !l.is_completed);

  const projectedCompleted = course.completed_lessons + (lessonId ? 1 : 0);
  const projectedProgress =
    course.total_lessons > 0
      ? Math.round((projectedCompleted / course.total_lessons) * 100)
      : 0;

  const create = useMutation({
    mutationFn: async (data: CourseSessionFormData) => {
      await courseSessionsService.create(data);
      if (lessonId) await courseLessonsService.bulkComplete([Number(lessonId)], true);
    },
    onSuccess: () => {
      toast({ title: t('pages.courses.sessions.saved') });
      void queryClient.invalidateQueries({ queryKey: ['course-modules', course.id] });
      void queryClient.invalidateQueries({ queryKey: ['course-sessions', course.id] });
      void queryClient.invalidateQueries({ queryKey: ['course', course.id] });
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
      onSaved();
    },
    onError: errorToast,
  });

  const onSubmit = (values: {
    session_date: string;
    duration_minutes: number;
    notes: string;
  }) => {
    create.mutate({
      course: course.id,
      session_date: values.session_date,
      duration_minutes: Number(values.duration_minutes),
      notes: values.notes || null,
      owner: course.owner,
    });
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit, notifyFormErrors)}
      className="space-y-md"
    >
      <div className="gap-md grid grid-cols-2">
        <div className="space-y-xs">
          <Label className="gap-xs flex items-center">
            <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.courses.sessions.dateLabel')}
          </Label>
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
          <Label className="gap-xs flex items-center" htmlFor="duration_minutes">
            <Timer className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.courses.sessions.durationLabel')}
          </Label>
          <Controller
            control={control}
            name="duration_minutes"
            render={({ field }) => (
              <NumberStepper
                id="duration_minutes"
                placeholder={t('pages.courses.sessions.durationPlaceholder')}
                min={1}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </div>
      <div className="space-y-xs">
        <Label className="gap-xs flex items-center" htmlFor="session_notes">
          <FileText className="text-muted-foreground h-3.5 w-3.5" />
          {t('pages.courses.sessions.notesLabel')}
        </Label>
        <Textarea
          id="session_notes"
          rows={1}
          placeholder={t('pages.courses.sessions.notesPlaceholder')}
          {...register('notes')}
        />
      </div>
      <div className="gap-md grid grid-cols-2">
        <div className="space-y-xs">
          <Label className="gap-xs flex items-center">
            <Layers className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.courses.sessions.moduleLabel')}
          </Label>
          <Select
            value={moduleId}
            onValueChange={(v) => {
              setModuleId(v);
              setLessonId('');
            }}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={t('pages.courses.sessions.modulePlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              {modules.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-xs">
          <Label className="gap-xs flex items-center">
            <PlayCircle className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.courses.sessions.lessonLabel')}
          </Label>
          <Select
            value={lessonId}
            onValueChange={setLessonId}
            disabled={pendingLessons.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={t('pages.courses.sessions.lessonPlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              {pendingLessons.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-xs">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>{t('pages.courses.stats.progress')}</span>
          <span className="text-foreground font-semibold">
            {t('pages.courses.sessions.progressValue', {
              done: projectedCompleted,
              total: course.total_lessons,
              percent: projectedProgress,
            })}
          </span>
        </div>
        <Progress value={projectedProgress} className="h-2" />
      </div>
      <div className="dialog-footer gap-sm flex justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" loading={create.isPending}>
          {!create.isPending && <Save className="h-4 w-4" />}
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}

export function CourseSessionsModal({ course, open, onClose }: CourseModalProps) {
  const { t } = useTranslation();
  const { showConfirm } = useAlertDialog();
  const invalidate = useInvalidateCourse(course?.id);
  const { data: fresh, isLoading: isLoadingCourse } = useFreshCourse(course, open);
  const c = fresh ?? course;
  const [formOpen, setFormOpen] = useState(false);

  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ['course-sessions', course?.id],
    queryFn: () => courseSessionsService.getAllPages({ course: course!.id }),
    enabled: !!course && open,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const deleteSession = useMutation({
    mutationFn: (id: number) => courseSessionsService.delete(id),
    onSuccess: () => {
      toast({ title: t('pages.courses.sessions.deleted') });
      invalidate();
    },
    onError: errorToast,
  });

  const totalHours = sessions.reduce((sum, s) => sum + s.duration_hours, 0);

  const weeklyHoursData = useMemo(() => {
    const weeks: Record<string, number> = {};
    sessions.forEach((s) => {
      const d = parseLocalDate(s.session_date) ?? new Date(s.session_date);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = formatLocalDate(monday);
      weeks[key] = (weeks[key] ?? 0) + s.duration_hours;
    });
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([date, hours]) => ({
        week: formatDate(date, 'dd/MM'),
        hours: Math.round(hours * 10) / 10,
      }));
  }, [sessions]);

  const openNewSession = () => {
    // Regra do backend: ao menos uma aula antes das sessões — aviso em toast (§2.1).
    if (!c?.total_lessons) {
      toast({ title: t('pages.courses.sessions.needsLesson'), variant: 'destructive' });
      return;
    }
    setFormOpen(true);
  };

  return (
    <>
      <Dialog
        open={open && !!c && !isLoadingCourse && !isLoadingSessions}
        onOpenChange={(v) => !v && onClose()}
      >
        <DialogContent className="max-w-xl">
          {c && (
            <>
              <DialogHeader>
                <DialogTitle icon={Timer}>
                  {t('pages.courses.sessions.title')}
                </DialogTitle>
                <VisuallyHidden>
                  <DialogDescription>{c.title}</DialogDescription>
                </VisuallyHidden>
              </DialogHeader>

              {sessions.length === 0 ? (
                <EmptyState
                  title={t('pages.courses.sessions.emptyState')}
                  icon={<Timer />}
                />
              ) : (
                <div className="space-y-md">
                  {weeklyHoursData.length > 1 && (
                    <ResponsiveContainer width="100%" height={110}>
                      <BarChart
                        data={weeklyHoursData}
                        margin={{ top: 2, right: 4, left: -20, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="week"
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                          content={
                            <EnhancedTooltip
                              formatter={(value) =>
                                t('pages.courses.hoursValue', { hours: Number(value) })
                              }
                              nameFormatter={() => t('pages.courses.studyHours.hours')}
                            />
                          }
                        />
                        <Bar
                          dataKey="hours"
                          fill="hsl(var(--category-intellect))"
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  <p className="text-muted-foreground text-sm">
                    {t('pages.courses.sessions.totalHours', {
                      hours: totalHours.toFixed(1),
                    })}
                  </p>
                  <PaginatedSlide
                    items={sessions}
                    pageSize={LIST_PAGE_SIZE}
                    pinNav={false}
                    className="space-y-xs"
                  >
                    {(pageSessions) =>
                      pageSessions.map((s) => (
                        <div
                          key={s.id}
                          className="gap-sm border-border px-sm py-xs flex items-center rounded-md border"
                        >
                          <Timer className="text-muted-foreground h-4 w-4 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">
                              {formatDate(s.session_date)}
                            </div>
                            {s.notes && (
                              <div
                                className="text-muted-foreground truncate text-xs"
                                title={s.notes}
                              >
                                {s.notes}
                              </div>
                            )}
                          </div>
                          <Badge variant="secondary" className="shrink-0">
                            {t('pages.courses.hoursValue', { hours: s.duration_hours })}
                          </Badge>
                          <RowIconButton
                            label={t('common.actions.delete')}
                            icon={Trash2}
                            color={ACTION_COLOR.delete}
                            onClick={() => {
                              void showConfirm({
                                title: t('common.messages.confirmDeleteTitle'),
                                description: formatDate(s.session_date),
                                variant: 'destructive',
                              }).then((ok) => {
                                if (ok) deleteSession.mutate(s.id);
                              });
                            }}
                          />
                        </div>
                      ))
                    }
                  </PaginatedSlide>
                </div>
              )}

              <DialogCloseFooter>
                <Button onClick={openNewSession}>
                  <Plus className="h-4 w-4" />
                  {t('pages.courses.sessions.newBtn')}
                </Button>
              </DialogCloseFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen && !!c} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle mode="create">
              {t('pages.courses.sessions.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>{c?.title}</DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          {c && (
            <AddSessionForm
              course={c}
              onSaved={() => setFormOpen(false)}
              onCancel={() => setFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// CERTIFICADO (ação)
// ============================================================================

export function CourseCertificateModal({ course, open, onClose }: CourseModalProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidateCourse(course?.id);
  const { data: fresh, isLoading } = useFreshCourse(course, open);
  const c = fresh ?? course;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [numPages, setNumPages] = useState(0);

  const canAttach = Boolean(
    c?.estimated_hours &&
    c.total_lessons > 0 &&
    c.progress_percentage === 100 &&
    c.invested_hours >= c.estimated_hours
  );

  const isImage = useMemo(() => {
    const url = c?.completion_certificate;
    if (!url) return false;
    const path = url.split('?')[0].toLowerCase();
    return path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png');
  }, [c?.completion_certificate]);

  // Streamed same-origin through Django (see CourseCertificateStreamView) so
  // both <img> and the PDF.js fetch below carry auth cookies without hitting
  // MinIO's CORS restrictions directly.
  const streamUrl = c
    ? `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.COURSE_CERTIFICATE_STREAM}${c.id}/certificate/stream/`
    : null;

  useEffect(() => {
    if (!showPreview || isImage || !streamUrl) return;
    let cancelled = false;
    fetch(streamUrl, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        if (!cancelled) setPdfData(buf);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      setPdfData(null);
    };
  }, [showPreview, isImage, streamUrl]);

  const patchCertificate = async (value: File | '') => {
    if (!c) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('completion_certificate', value);
      await coursesService.patch(c.id, form as unknown as Partial<never>);
      invalidate();
      toast({
        title: value
          ? t('pages.courses.certificate.uploaded')
          : t('pages.courses.certificate.removed'),
      });
    } catch {
      toast({
        title: t('pages.courses.certificate.uploadError'),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const pickFile = () => {
    if (!canAttach) {
      toast({
        title: t('pages.courses.certificate.needsCompletion'),
        variant: 'destructive',
      });
      return;
    }
    fileRef.current?.click();
  };

  return (
    <>
      <Dialog open={open && !!c && !isLoading} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md">
          {c && (
            <>
              <DialogHeader>
                <DialogTitle icon={Award}>
                  {t('pages.courses.tabs.certificate')}
                </DialogTitle>
                <VisuallyHidden>
                  <DialogDescription>{c.title}</DialogDescription>
                </VisuallyHidden>
              </DialogHeader>

              {c.completion_certificate ? (
                <div className="gap-md border-border p-md flex items-center rounded-lg border">
                  <Award className="text-category-intellect h-8 w-8 shrink-0" />
                  <p className="min-w-0 flex-1 text-sm font-medium">
                    {t('pages.courses.certificate.fileLabel')}
                  </p>
                  <RowIconButton
                    label={t('pages.courses.certificate.view')}
                    icon={Eye}
                    color={ACTION_COLOR.preview}
                    onClick={() => setShowPreview(true)}
                  />
                  <RowIconButton
                    label={t('common.actions.remove')}
                    icon={Trash2}
                    color={ACTION_COLOR.delete}
                    disabled={uploading}
                    onClick={() => void patchCertificate('')}
                  />
                </div>
              ) : (
                <EmptyState
                  title={t('pages.courses.certificate.emptyTitle')}
                  icon={<Award />}
                />
              )}

              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void patchCertificate(file);
                  e.target.value = '';
                }}
              />

              <DialogCloseFooter>
                <Button onClick={pickFile} loading={uploading}>
                  {!uploading && <Upload className="h-4 w-4" />}
                  {c.completion_certificate
                    ? t('pages.courses.certificate.replaceBtn')
                    : t('pages.courses.certificate.uploadBtn')}
                </Button>
              </DialogCloseFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {c?.completion_certificate && streamUrl && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent size="xl">
            <DialogHeader>
              <DialogTitle icon={Award}>
                {t('pages.courses.certificate.previewTitle')}
              </DialogTitle>
            </DialogHeader>
            {/* Exceção §2.5: visualizador de documento rola por natureza. */}
            <div className="bg-muted/20 border-border h-[75vh] w-full overflow-auto rounded-md border">
              {isImage ? (
                <img
                  src={streamUrl}
                  alt={t('pages.courses.certificate.previewTitle')}
                  className="mx-auto h-full w-auto object-contain"
                />
              ) : (
                <div className="py-lg gap-md flex flex-col items-center">
                  {pdfData ? (
                    <Document
                      file={pdfData}
                      onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                      error={
                        <EmptyState
                          title={t('pages.courses.certificate.previewError')}
                          icon={<Award />}
                        />
                      }
                    >
                      {Array.from({ length: numPages }, (_, i) => (
                        <Page
                          key={i}
                          pageNumber={i + 1}
                          renderAnnotationLayer={false}
                          renderTextLayer={false}
                          className="border-border border"
                          width={Math.min(760, window.innerWidth - 96)}
                        />
                      ))}
                    </Document>
                  ) : null}
                </div>
              )}
            </div>
            <DialogCloseFooter />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
