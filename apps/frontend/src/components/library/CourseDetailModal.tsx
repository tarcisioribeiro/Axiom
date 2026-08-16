/* eslint-disable max-lines, react-hooks/incompatible-library */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Circle,
  Edit,
  ExternalLink,
  GraduationCap,
  Layers,
  Loader2,
  Plus,
  Square,
  Timer,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
// Configure PDF.js worker via Vite ?url import for reliable asset bundling
// (same setup as BookReader.tsx — safe to register more than once).
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Document, Page, pdfjs } from 'react-pdf';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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
import { API_CONFIG } from '@/config/constants';
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

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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

  const bulkComplete = useMutation({
    mutationFn: ({ ids, done }: { ids: number[]; done: boolean }) =>
      courseLessonsService.bulkComplete(ids, done),
    onSuccess: () => {
      setSelectedIds(new Set());
      void refetchLessons();
      onUpdated();
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = lessons.length > 0 && selectedIds.size === lessons.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(lessons.map((l) => l.id)));
    }
  };

  const completedCount = lessons.filter((l) => l.is_completed).length;

  return (
    <div className="border-border bg-card p-md rounded-lg border">
      <div className="gap-sm flex items-start justify-between">
        <div className="gap-sm flex min-w-0 flex-1 items-center">
          <Layers className="text-category-intellect mt-0.5 h-4 w-4 shrink-0" />
          {isEditing ? (
            <div className="gap-sm flex flex-1">
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                className="h-7 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                className="px-sm h-7"
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
        <div className="gap-xs flex shrink-0 items-center">
          <span className="text-muted-foreground text-xs">
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
            className="text-destructive hover:text-destructive h-6 w-6"
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

      {/* Bulk action bar */}
      {lessons.length > 0 && (
        <div className="mt-sm gap-sm flex items-center justify-between">
          <button
            type="button"
            className="gap-xs text-muted-foreground hover:text-foreground flex items-center text-xs"
            onClick={toggleSelectAll}
          >
            {allSelected ? (
              <CheckSquare className="text-category-intellect h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            {t('pages.courses.lessons.selectAll')}
          </button>
          {selectedIds.size > 0 && (
            <div className="gap-xs flex items-center">
              <span className="text-muted-foreground text-xs">
                {selectedIds.size} {t('pages.courses.lessons.selected')}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="gap-xs px-sm text-success h-6 text-xs"
                disabled={bulkComplete.isPending}
                onClick={() =>
                  bulkComplete.mutate({ ids: [...selectedIds], done: true })
                }
              >
                <CheckCircle2 className="h-3 w-3" />
                {t('pages.courses.lessons.markDone')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-xs px-sm h-6 text-xs"
                disabled={bulkComplete.isPending}
                onClick={() =>
                  bulkComplete.mutate({ ids: [...selectedIds], done: false })
                }
              >
                <Circle className="h-3 w-3" />
                {t('pages.courses.lessons.markPending')}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="mt-sm space-y-xs">
        {lessons.map((lesson) => (
          <div
            key={lesson.id}
            className="gap-sm px-sm py-xs hover:bg-muted/40 flex items-center justify-between rounded transition-colors"
          >
            <button
              type="button"
              className="flex shrink-0"
              onClick={() => toggleSelect(lesson.id)}
            >
              {selectedIds.has(lesson.id) ? (
                <CheckSquare className="text-category-intellect h-4 w-4" />
              ) : (
                <Square className="text-muted-foreground/40 hover:text-muted-foreground h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              className="gap-sm flex min-w-0 flex-1 items-center"
              onClick={() => toggleLesson.mutate(lesson.id)}
            >
              {lesson.is_completed ? (
                <CheckCircle2 className="text-category-intellect h-4 w-4 shrink-0" />
              ) : (
                <Circle className="text-muted-foreground/50 h-4 w-4 shrink-0" />
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
              className="text-muted-foreground hover:text-destructive h-5 w-5 shrink-0"
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
          <div className="gap-sm pt-xs flex">
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
              className="px-sm h-7"
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
            className="gap-xs px-sm py-xs text-muted-foreground hover:bg-category-intellect/5 hover:text-category-intellect flex w-full items-center rounded text-xs transition-colors"
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
    <div className="gap-sm border-border bg-card p-sm flex items-center justify-between rounded-lg border">
      <div className="gap-sm flex min-w-0 flex-1 items-center">
        <Timer className="text-category-intellect h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-medium">{formatDate(session.session_date)}</div>
          {session.notes && (
            <div className="text-muted-foreground truncate text-xs">
              {session.notes}
            </div>
          )}
        </div>
      </div>
      <div className="gap-sm flex shrink-0 items-center">
        <span className="bg-category-intellect/10 px-sm py-xs text-category-intellect rounded text-xs font-semibold">
          {session.duration_hours}h
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive h-6 w-6"
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
      className="space-y-md border-category-intellect/20 bg-category-intellect/5 p-md rounded-lg border"
    >
      <div className="gap-md grid grid-cols-2">
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
      <div className="gap-sm flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={create.isPending}
          className="bg-category-intellect hover:bg-category-intellect/90 text-white"
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
  const [showCertPreview, setShowCertPreview] = useState(false);
  const [certPdfData, setCertPdfData] = useState<ArrayBuffer | null>(null);
  const [certNumPages, setCertNumPages] = useState(0);

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

  const isCertificateImage = useMemo(() => {
    const url = displayCourse?.completion_certificate;
    if (!url) return false;
    const path = url.split('?')[0].toLowerCase();
    return path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png');
  }, [displayCourse?.completion_certificate]);

  // Streamed same-origin through Django (see CourseCertificateStreamView) so
  // both <img> and the PDF.js fetch below carry auth cookies without hitting
  // MinIO's CORS restrictions directly.
  const certificateStreamUrl = displayCourse
    ? `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.COURSE_CERTIFICATE_STREAM}${displayCourse.id}/certificate/stream/`
    : null;

  useEffect(() => {
    if (!showCertPreview || isCertificateImage || !certificateStreamUrl) return;
    let cancelled = false;
    fetch(certificateStreamUrl, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        if (!cancelled) setCertPdfData(buf);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      setCertPdfData(null);
    };
  }, [showCertPreview, isCertificateImage, certificateStreamUrl]);

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

  const weeklyHoursData = useMemo(() => {
    const weeks: Record<string, number> = {};
    sessions.forEach((s) => {
      const d = new Date(s.session_date);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      weeks[key] = (weeks[key] ?? 0) + s.duration_hours;
    });
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([date, hours]) => ({
        week: date.slice(5),
        hours: Math.round(hours * 10) / 10,
      }));
  }, [sessions]);

  if (!displayCourse) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
          {/* Colored header */}
          <div className="bg-category-intellect/10 px-xl pb-md pt-xl">
            <DialogHeader>
              <div className="gap-md flex items-start justify-between">
                <div className="gap-md flex min-w-0 flex-1 items-center">
                  <div className="bg-category-intellect/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                    <GraduationCap className="text-category-intellect h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-lg font-bold">
                      {displayCourse.title}
                    </DialogTitle>
                    <DialogDescription className="mt-xs gap-sm flex items-center">
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
                <div className="mb-xs text-muted-foreground flex items-center justify-between text-xs">
                  <span>{t('pages.courses.stats.progress')}</span>
                  <span className="text-category-intellect font-semibold">
                    {displayCourse.progress_percentage}%
                  </span>
                </div>
                <Progress
                  value={displayCourse.progress_percentage}
                  className="bg-category-intellect/20 h-2"
                />
              </div>

              {/* Stats row */}
              <div className="mt-md gap-sm grid grid-cols-3">
                <div className="bg-background/60 p-sm rounded-lg text-center">
                  <div className="text-category-intellect text-lg font-bold">
                    {displayCourse.completed_lessons}/{displayCourse.total_lessons}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t('pages.courses.stats.lessons')}
                  </div>
                </div>
                <div className="bg-background/60 p-sm rounded-lg text-center">
                  <div className="text-category-intellect text-lg font-bold">
                    {displayCourse.invested_hours.toFixed(1)}h
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t('pages.courses.stats.investedHours')}
                  </div>
                </div>
                <div className="bg-background/60 p-sm rounded-lg text-center">
                  <div className="text-category-intellect text-lg font-bold">
                    {displayCourse.estimated_hours
                      ? `${displayCourse.estimated_hours}h`
                      : '—'}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t('pages.courses.stats.estimatedHours')}
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="mt-md gap-sm flex">
              <Button
                size="sm"
                variant="outline"
                className="gap-xs h-8"
                onClick={() => onEdit(displayCourse)}
              >
                <Edit className="h-3.5 w-3.5" />
                {t('common.actions.edit')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-xs text-destructive hover:text-destructive h-8"
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
                <div className="bg-muted/30 p-md text-muted-foreground rounded-lg text-sm leading-relaxed">
                  {displayCourse.description}
                </div>
              )}
              {displayCourse.url && (
                <a
                  href={displayCourse.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-sm text-category-intellect flex items-center text-sm hover:underline"
                >
                  <GraduationCap className="h-4 w-4" />
                  {displayCourse.url}
                </a>
              )}
              <div className="gap-sm grid grid-cols-2 text-sm">
                {displayCourse.start_date && (
                  <div className="gap-xs text-muted-foreground flex items-center">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(displayCourse.start_date)}
                  </div>
                )}
                {displayCourse.end_date && (
                  <div className="gap-xs text-muted-foreground flex items-center">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(displayCourse.end_date)}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="modules" className="mt-md space-y-sm">
              {modules.length === 0 && !showAddModule && (
                <div className="border-category-intellect/30 bg-category-intellect/5 p-lg rounded-lg border border-dashed text-center">
                  <Layers className="mb-sm text-category-intellect/40 mx-auto h-8 w-8" />
                  <p className="text-foreground text-sm font-medium">
                    {t('pages.courses.modules.emptyTitle')}
                  </p>
                  <p className="mt-xs text-muted-foreground text-xs">
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
                <div className="gap-sm flex">
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
                  className="gap-sm text-muted-foreground hover:border-category-intellect/50 hover:text-category-intellect w-full border-dashed"
                  onClick={() => setShowAddModule(true)}
                >
                  <Plus className="h-4 w-4" />
                  {t('pages.courses.modules.newBtn')}
                </Button>
              )}
            </TabsContent>

            <TabsContent value="sessions" className="mt-md space-y-sm">
              {weeklyHoursData.length > 1 && (
                <div className="border-border p-sm rounded-lg border">
                  <p className="mb-sm text-muted-foreground text-xs font-medium">
                    {t('pages.courses.studyHours.title')}
                  </p>
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart
                      data={weeklyHoursData}
                      margin={{ top: 2, right: 4, left: -20, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 9 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(v) => [
                          `${Number(v)}h`,
                          t('pages.courses.studyHours.hours'),
                        ]}
                        labelStyle={{ fontSize: 11 }}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Bar
                        dataKey="hours"
                        fill="hsl(var(--category-intellect))"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  {t('pages.courses.sessions.totalHours', {
                    hours: totalSessionHours.toFixed(1),
                  })}
                </span>
                <Button
                  size="sm"
                  className="gap-xs bg-category-intellect hover:bg-category-intellect/90 text-white"
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
                <p className="py-md text-muted-foreground text-center text-sm">
                  {t('pages.courses.sessions.emptyState')}
                </p>
              ) : (
                sessions.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    onDeleted={handleSessionUpdated}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="certificate" className="mt-md space-y-md">
              {displayCourse.completion_certificate ? (
                <div className="space-y-md">
                  <div className="gap-md border-category-intellect/20 bg-category-intellect/5 p-md flex items-center rounded-lg border">
                    <Award className="text-category-intellect h-8 w-8 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {t('pages.courses.certificate.fileLabel')}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowCertPreview(true)}
                        className="gap-xs text-primary inline-flex items-center text-xs underline-offset-2 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {t('pages.courses.certificate.viewLink')}
                      </button>
                    </div>
                    <div className="gap-xs flex shrink-0">
                      <button
                        type="button"
                        disabled={uploadingCert}
                        onClick={() => void handleCertificateRemove()}
                        className="border-border text-destructive hover:bg-destructive/10 inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors"
                      >
                        {uploadingCert ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <label className="gap-sm border-border p-md hover:bg-muted/30 flex cursor-pointer flex-col items-center rounded-lg border border-dashed text-center transition-colors">
                    <Upload className="text-muted-foreground h-5 w-5" />
                    <span className="text-muted-foreground text-xs">
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
                <label className="gap-md border-category-intellect/30 bg-category-intellect/5 p-xl hover:bg-category-intellect/10 flex cursor-pointer flex-col items-center rounded-lg border border-dashed text-center transition-colors">
                  {uploadingCert ? (
                    <Loader2 className="text-category-intellect/50 h-10 w-10 animate-spin" />
                  ) : (
                    <Award className="text-category-intellect/40 h-10 w-10" />
                  )}
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      {t('pages.courses.certificate.emptyTitle')}
                    </p>
                    <p className="mt-xs text-muted-foreground text-xs">
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

      {displayCourse.completion_certificate && certificateStreamUrl && (
        <Dialog open={showCertPreview} onOpenChange={setShowCertPreview}>
          <DialogContent size="xl" className="max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{t('pages.courses.certificate.previewTitle')}</DialogTitle>
            </DialogHeader>
            <div className="bg-muted/20 border-border h-[75vh] w-full overflow-auto rounded-md border">
              {isCertificateImage ? (
                <img
                  src={certificateStreamUrl}
                  alt={t('pages.courses.certificate.previewTitle')}
                  className="mx-auto h-full w-auto object-contain"
                />
              ) : (
                <div className="py-lg gap-md flex flex-col items-center">
                  {certPdfData ? (
                    <Document
                      file={certPdfData}
                      onLoadSuccess={({ numPages }) => setCertNumPages(numPages)}
                      loading={
                        <div className="flex h-64 items-center justify-center">
                          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                        </div>
                      }
                      error={
                        <div className="gap-sm text-muted-foreground flex h-64 flex-col items-center justify-center">
                          <Award className="h-10 w-10" />
                          <p className="text-sm">
                            {t('pages.courses.certificate.previewError')}
                          </p>
                        </div>
                      }
                    >
                      {Array.from({ length: certNumPages }, (_, i) => (
                        <Page
                          key={i}
                          pageNumber={i + 1}
                          renderAnnotationLayer={false}
                          renderTextLayer={false}
                          className="shadow-md"
                          width={Math.min(760, window.innerWidth - 96)}
                        />
                      ))}
                    </Document>
                  ) : (
                    <div className="flex h-64 items-center justify-center">
                      <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
