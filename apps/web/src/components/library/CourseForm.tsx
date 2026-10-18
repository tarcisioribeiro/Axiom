/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Atom,
  Briefcase,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  Layers,
  MonitorPlay,
  MoreHorizontal,
  Paintbrush,
  Palette,
  Save,
  Tag,
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { DecimalInput } from '@/components/ui/decimal-input';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notifyFormErrors } from '@/lib/form-errors';
import { cn, formatLocalDate, parseLocalDate } from '@/lib/utils';
import type {
  Course,
  CourseFormData,
  CoursePlatform,
  CourseStatus,
  IntellectCategory,
} from '@/types';
import type { IconComponent } from '@/types/icon';

const courseSchema = z.object({
  title: z.string().min(1),
  platform: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional().nullable(),
  url: z.string().url().optional().or(z.literal('')).nullable(),
  estimated_hours: z.number().positive().optional().nullable(),
  status: z.string().min(1),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  study_weekdays: z.array(z.number()),
  owner: z.number(),
});

type CourseFormValues = z.infer<typeof courseSchema>;

interface CourseFormProps {
  course?: Course;
  ownerId: number;
  onSubmit: (data: CourseFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const PLATFORMS: CoursePlatform[] = [
  'udemy',
  'coursera',
  'youtube',
  'linkedin',
  'alura',
  'pluralsight',
  'other',
];
const CATEGORIES: IntellectCategory[] = [
  'technology',
  'languages',
  'design',
  'business',
  'science',
  'arts',
  'other',
];

const CATEGORY_ICONS: Record<IntellectCategory, IconComponent> = {
  technology: Code2,
  languages: Globe,
  design: Palette,
  business: Briefcase,
  science: Atom,
  arts: Paintbrush,
  other: MoreHorizontal,
};
const STATUSES: CourseStatus[] = ['not_started', 'in_progress', 'completed', 'paused'];
// 0 = segunda … 6 = domingo (mesma convenção do backend)
const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export function CourseForm({
  course,
  ownerId,
  onSubmit,
  onCancel,
  isLoading,
}: CourseFormProps) {
  const { t } = useTranslation();

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: '',
      platform: 'udemy',
      category: 'technology',
      description: null,
      url: null,
      estimated_hours: null,
      status: 'not_started',
      start_date: course ? null : formatLocalDate(new Date()),
      end_date: null,
      study_weekdays: [],
      owner: ownerId,
    },
  });

  useEffect(() => {
    if (course) {
      reset({
        title: course.title,
        platform: course.platform,
        category: course.category,
        description: course.description ?? null,
        url: course.url ?? null,
        estimated_hours: course.estimated_hours ?? null,
        status: course.status,
        start_date: course.start_date ?? null,
        end_date: course.end_date ?? null,
        study_weekdays: course.study_weekdays ?? [],
        owner: course.owner,
      });
    } else {
      reset({ ...watch(), owner: ownerId });
    }
  }, [course, ownerId, reset, watch]);

  const handleFormSubmit = async (values: CourseFormValues) => {
    await onSubmit({
      title: values.title,
      platform: values.platform as CoursePlatform,
      category: values.category as IntellectCategory,
      description: values.description || null,
      url: values.url || null,
      estimated_hours: values.estimated_hours ?? null,
      status: values.status as CourseStatus,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      study_weekdays: values.study_weekdays,
      owner: values.owner,
    });
  };

  const startDate = watch('start_date');
  const endDate = watch('end_date');
  const studyDays = watch('study_weekdays');

  return (
    <form
      noValidate
      onSubmit={handleSubmit(handleFormSubmit, notifyFormErrors)}
      className="space-y-lg"
    >
      <FormSection title={t('pages.courses.form.sectionInfo')} icon={GraduationCap}>
        <div className="space-y-sm">
          <Label className="gap-xs flex items-center" htmlFor="title">
            <FileText className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.courses.form.titleLabel')}
          </Label>
          <Input
            id="title"
            placeholder={t('pages.courses.form.titlePlaceholder')}
            {...register('title')}
            aria-invalid={!!errors.title}
          />
        </div>

        <div className="gap-md grid grid-cols-2">
          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <MonitorPlay className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.courses.form.platformLabel')}
            </Label>
            <Select
              value={watch('platform')}
              onValueChange={(v) => setValue('platform', v)}
            >
              <SelectTrigger aria-invalid={!!errors.platform}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`pages.courses.platform.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <Tag className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.courses.form.categoryLabel')}
            </Label>
            <Select
              value={watch('category')}
              onValueChange={(v) => setValue('category', v)}
            >
              <SelectTrigger aria-invalid={!!errors.category}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => {
                  const Icon = CATEGORY_ICONS[c];
                  return (
                    <SelectItem key={c} value={c}>
                      <div className="gap-xs flex items-center">
                        <Icon className="text-category-intellect h-3.5 w-3.5" />
                        {t(`pages.courses.category.${c}`)}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-sm">
          <Label htmlFor="url">
            <div className="gap-xs flex items-center">
              <ExternalLink className="h-3.5 w-3.5" />
              {t('pages.courses.form.urlLabel')}
            </div>
          </Label>
          <Input
            id="url"
            placeholder={t('pages.courses.form.urlPlaceholder')}
            {...register('url')}
            aria-invalid={!!errors.url}
          />
        </div>

        <div className="space-y-sm">
          <Label className="gap-xs flex items-center" htmlFor="description">
            <FileText className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.courses.form.descriptionLabel')}
          </Label>
          <Textarea
            id="description"
            placeholder={t('pages.courses.form.descriptionPlaceholder')}
            rows={3}
            {...register('description')}
          />
        </div>
      </FormSection>

      <FormSection title={t('pages.courses.form.sectionDetails')} icon={Layers}>
        <div className="gap-md grid grid-cols-2">
          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <CheckCircle2 className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.courses.form.statusLabel')}
            </Label>
            <Select
              value={watch('status')}
              onValueChange={(v) => setValue('status', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`pages.courses.status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-sm">
            <Label htmlFor="estimated_hours">
              <div className="gap-xs flex items-center">
                <Clock className="h-3.5 w-3.5" />
                {t('pages.courses.form.estimatedHoursLabel')}
              </div>
            </Label>
            <Controller
              control={control}
              name="estimated_hours"
              render={({ field }) => (
                <DecimalInput
                  id="estimated_hours"
                  decimals={1}
                  step={0.5}
                  unit="h"
                  value={field.value}
                  onChange={field.onChange}
                  aria-invalid={!!errors.estimated_hours}
                />
              )}
            />
          </div>
        </div>

        <div className="gap-md grid grid-cols-2">
          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.courses.form.startDateLabel')}
            </Label>
            <DatePicker
              value={startDate ? parseLocalDate(startDate) : undefined}
              onChange={(d) => setValue('start_date', d ? formatLocalDate(d) : null)}
            />
          </div>
          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.courses.form.endDateLabel')}
            </Label>
            <DatePicker
              value={endDate ? parseLocalDate(endDate) : undefined}
              onChange={(d) => setValue('end_date', d ? formatLocalDate(d) : null)}
            />
          </div>
        </div>

        <div className="space-y-sm">
          <Label className="gap-xs flex items-center">
            <CalendarRange className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.courses.form.studyWeekdaysLabel')}
          </Label>
          <div className="gap-xs flex flex-wrap justify-center">
            {WEEKDAYS.map((wd, i) => {
              const selected = studyDays.includes(i);
              return (
                <button
                  key={wd}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setValue(
                      'study_weekdays',
                      selected
                        ? studyDays.filter((d) => d !== i)
                        : [...studyDays, i].sort()
                    )
                  }
                  className={cn(
                    'px-sm py-xs rounded-full border text-xs font-medium transition',
                    selected
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary'
                  )}
                >
                  {t(`pages.workoutPlans.weekdays.${wd}`)}
                </button>
              );
            })}
          </div>
        </div>
      </FormSection>

      <div className="dialog-footer gap-sm pt-sm flex justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          <X className="h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" loading={isLoading}>
          {!isLoading && <Save className="h-4 w-4" />}
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
