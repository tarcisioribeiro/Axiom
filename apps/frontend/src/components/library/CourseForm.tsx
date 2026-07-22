/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Atom,
  Briefcase,
  Clock,
  Code2,
  ExternalLink,
  Globe,
  GraduationCap,
  Layers,
  MoreHorizontal,
  Paintbrush,
  Palette,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
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
import { formatLocalDate, parseLocalDate } from '@/lib/utils';
import type {
  Course,
  CourseFormData,
  CoursePlatform,
  CourseStatus,
  IntellectCategory,
} from '@/types';

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

const CATEGORY_ICONS: Record<IntellectCategory, LucideIcon> = {
  technology: Code2,
  languages: Globe,
  design: Palette,
  business: Briefcase,
  science: Atom,
  arts: Paintbrush,
  other: MoreHorizontal,
};
const STATUSES: CourseStatus[] = ['not_started', 'in_progress', 'completed', 'paused'];

export function CourseForm({
  course,
  ownerId,
  onSubmit,
  onCancel,
  isLoading,
}: CourseFormProps) {
  const { t } = useTranslation();

  const {
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
      start_date: null,
      end_date: null,
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
      owner: values.owner,
    });
  };

  const startDate = watch('start_date');
  const endDate = watch('end_date');

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg">
      <FormSection title={t('pages.courses.form.sectionInfo')} icon={GraduationCap}>
        <div className="space-y-sm">
          <Label htmlFor="title">{t('pages.courses.form.titleLabel')}</Label>
          <Input
            id="title"
            placeholder={t('pages.courses.form.titlePlaceholder')}
            {...register('title')}
            className={errors.title ? 'border-destructive' : ''}
          />
          {errors.title && (
            <p className="text-xs text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-md">
          <div className="space-y-sm">
            <Label>{t('pages.courses.form.platformLabel')}</Label>
            <Select
              value={watch('platform')}
              onValueChange={(v) => setValue('platform', v)}
            >
              <SelectTrigger>
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
            <Label>{t('pages.courses.form.categoryLabel')}</Label>
            <Select
              value={watch('category')}
              onValueChange={(v) => setValue('category', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => {
                  const Icon = CATEGORY_ICONS[c];
                  return (
                    <SelectItem key={c} value={c}>
                      <div className="flex items-center gap-xs">
                        <Icon className="h-3.5 w-3.5 text-category-intellect" />
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
            <div className="flex items-center gap-xs">
              <ExternalLink className="h-3.5 w-3.5" />
              {t('pages.courses.form.urlLabel')}
            </div>
          </Label>
          <Input
            id="url"
            placeholder={t('pages.courses.form.urlPlaceholder')}
            {...register('url')}
            className={errors.url ? 'border-destructive' : ''}
          />
        </div>

        <div className="space-y-sm">
          <Label htmlFor="description">
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
        <div className="grid grid-cols-2 gap-md">
          <div className="space-y-sm">
            <Label>{t('pages.courses.form.statusLabel')}</Label>
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
              <div className="flex items-center gap-xs">
                <Clock className="h-3.5 w-3.5" />
                {t('pages.courses.form.estimatedHoursLabel')}
              </div>
            </Label>
            <Input
              id="estimated_hours"
              type="number"
              min={0}
              step={0.5}
              {...register('estimated_hours', { valueAsNumber: true })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-md">
          <div className="space-y-sm">
            <Label>{t('pages.courses.form.startDateLabel')}</Label>
            <DatePicker
              value={startDate ? parseLocalDate(startDate) : undefined}
              onChange={(d) => setValue('start_date', d ? formatLocalDate(d) : null)}
            />
          </div>
          <div className="space-y-sm">
            <Label>{t('pages.courses.form.endDateLabel')}</Label>
            <DatePicker
              value={endDate ? parseLocalDate(endDate) : undefined}
              onChange={(d) => setValue('end_date', d ? formatLocalDate(d) : null)}
            />
          </div>
        </div>
      </FormSection>

      <div className="flex justify-end gap-sm pt-sm">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-category-intellect text-white hover:bg-category-intellect/90"
        >
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
