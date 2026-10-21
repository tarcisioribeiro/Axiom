/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  Atom,
  Brain,
  Briefcase,
  CheckCircle2,
  Code2,
  FileText,
  Gauge,
  Globe,
  GraduationCap,
  Layers,
  MoreHorizontal,
  Paintbrush,
  Palette,
  Save,
  Tag,
  Type,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { toast } from '@/hooks/use-toast';
import { notifyFormErrors, serverFieldError } from '@/lib/form-errors';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { coursesService } from '@/services/courses-service';
import type {
  IntellectCategory,
  Skill,
  SkillFormData,
  SkillProficiency,
  SkillStatus,
} from '@/types';
import type { IconComponent } from '@/types/icon';

const makeSkillSchema = (messages: {
  name: string;
  category: string;
  proficiency: string;
  status: string;
}) =>
  z.object({
    name: z.string().trim().min(1, messages.name),
    category: z.string().min(1, messages.category),
    proficiency: z.string().min(1, messages.proficiency),
    status: z.string().min(1, messages.status),
    notes: z.string().optional().nullable(),
    owner: z.number(),
  });

type SkillFormValues = z.infer<ReturnType<typeof makeSkillSchema>>;

interface SkillFormProps {
  skill?: Skill;
  ownerId: number;
  onSubmit: (data: SkillFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const PROFICIENCY_LEVELS: { value: SkillProficiency; dots: number }[] = [
  { value: 'beginner', dots: 1 },
  { value: 'basic', dots: 2 },
  { value: 'intermediate', dots: 3 },
  { value: 'advanced', dots: 4 },
  { value: 'expert', dots: 5 },
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

const STATUSES: SkillStatus[] = ['learning', 'evolving', 'mastered'];

const STATUS_COLORS: Record<SkillStatus, string> = {
  learning: 'border-info bg-info/10 text-info',
  evolving: 'border-warning bg-warning/10 text-warning',
  mastered: 'border-success bg-success/10 text-success',
};

function ProficiencySelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: SkillProficiency) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="gap-sm grid grid-cols-5">
      {PROFICIENCY_LEVELS.map(({ value: lvl, dots }) => (
        <button
          key={lvl}
          type="button"
          onClick={() => onChange(lvl)}
          className={cn(
            'gap-xs p-sm flex flex-col items-center rounded-lg border-2 transition',
            value === lvl
              ? 'border-category-intellect bg-category-intellect/10'
              : 'border-border bg-background hover:border-category-intellect/40'
          )}
        >
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-colors',
                  i < dots
                    ? value === lvl
                      ? 'bg-category-intellect'
                      : 'bg-muted-foreground/50'
                    : 'bg-muted-foreground/20'
                )}
              />
            ))}
          </div>
          <span
            className={cn(
              'text-2xs text-center leading-tight font-medium',
              value === lvl ? 'text-category-intellect' : 'text-muted-foreground'
            )}
          >
            {t(`pages.skills.proficiency.${lvl}`)}
          </span>
        </button>
      ))}
    </div>
  );
}

export function SkillForm({
  skill,
  ownerId,
  onSubmit,
  onCancel,
  isLoading,
}: SkillFormProps) {
  const { t } = useTranslation();

  const [selectedCourses, setSelectedCourses] = useState<number[]>(() =>
    skill ? skill.courses.map((c) => c.id) : []
  );

  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const skillSchema = useMemo(
    () =>
      makeSkillSchema({
        name: t('common.fieldRequired', { field: t('pages.skills.form.nameLabel') }),
        category: t('common.fieldRequired', {
          field: t('pages.skills.form.categoryLabel'),
        }),
        proficiency: t('common.fieldRequired', {
          field: t('pages.skills.form.proficiencyLabel'),
        }),
        status: t('common.fieldRequired', {
          field: t('pages.skills.form.statusLabel'),
        }),
      }),
    [t]
  );

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = useForm<SkillFormValues>({
    resolver: zodResolver(skillSchema),
    defaultValues: {
      name: skill?.name ?? '',
      category: skill?.category ?? 'technology',
      proficiency: skill?.proficiency ?? 'beginner',
      status: skill?.status ?? 'learning',
      notes: skill?.notes ?? null,
      owner: skill?.owner ?? ownerId,
    },
  });

  const handleCourseToggle = (courseId: number) => {
    setSelectedCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleRemoveCourse = (courseId: number) => {
    setSelectedCourses((prev) => prev.filter((id) => id !== courseId));
  };

  const handleFormSubmit = async (values: SkillFormValues) => {
    try {
      await onSubmit({
        name: values.name,
        category: values.category as IntellectCategory,
        proficiency: values.proficiency as SkillProficiency,
        course_ids: selectedCourses,
        status: values.status as SkillStatus,
        notes: values.notes || null,
        owner: values.owner,
      });
    } catch (err: unknown) {
      // Nome duplicado → borda no campo + toast (§3); demais erros já
      // foram notificados pela mutation da página.
      if (serverFieldError(err, 'name')) {
        const message = t('pages.skills.form.nameDuplicate');
        setError('name', { type: 'server', message });
        toast({ title: message, variant: 'destructive' });
      }
    }
  };

  const currentStatus = watch('status') as SkillStatus;

  return (
    <form
      noValidate
      onSubmit={handleSubmit(handleFormSubmit, notifyFormErrors)}
      className="space-y-lg"
    >
      <FormSection title={t('pages.skills.form.sectionInfo')} icon={Brain}>
        <div className="space-y-sm">
          <Label className="gap-xs flex items-center" htmlFor="name">
            <Type className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.skills.form.nameLabel')}
          </Label>
          <Input
            id="name"
            placeholder={t('pages.skills.form.namePlaceholder')}
            aria-invalid={!!errors.name}
            {...register('name')}
          />
        </div>

        <div className="space-y-sm">
          <Label className="gap-xs flex items-center">
            <Tag className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.skills.form.categoryLabel')}
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
                      {t(`pages.skills.category.${c}`)}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </FormSection>

      <FormSection title={t('pages.skills.form.sectionProgress')} icon={Layers}>
        <div className="space-y-sm">
          <Label className="gap-xs flex items-center">
            <Gauge className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.skills.form.proficiencyLabel')}
          </Label>
          <ProficiencySelector
            value={watch('proficiency')}
            onChange={(v) => setValue('proficiency', v)}
          />
        </div>

        <div className="space-y-sm">
          <Label className="gap-xs flex items-center">
            <CheckCircle2 className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.skills.form.statusLabel')}
          </Label>
          <div className="gap-sm flex">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setValue('status', s)}
                className={cn(
                  'px-sm py-sm flex-1 rounded-lg border-2 text-xs font-semibold transition',
                  currentStatus === s
                    ? STATUS_COLORS[s]
                    : 'border-border bg-background text-muted-foreground hover:border-border/80'
                )}
              >
                {t(`pages.skills.status.${s}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-sm">
          <Label className="gap-xs flex items-center" htmlFor="notes">
            <FileText className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.skills.form.notesLabel')}
          </Label>
          <Textarea
            id="notes"
            rows={1}
            placeholder={t('pages.skills.form.notesPlaceholder')}
            {...register('notes')}
          />
        </div>
      </FormSection>

      <FormSection title={t('pages.skills.form.sectionCourses')} icon={GraduationCap}>
        <div className="space-y-sm">
          <Label className="gap-xs flex items-center">
            <GraduationCap className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.skills.form.coursesLabel')}
          </Label>
          <Select onValueChange={(v) => handleCourseToggle(parseInt(v, 10))}>
            <SelectTrigger>
              <SelectValue placeholder={t('pages.skills.form.coursesPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id.toString()}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-sm gap-sm flex min-h-[1.375rem] flex-wrap">
            {selectedCourses.map((courseId) => {
              const course = courses.find((c) => c.id === courseId);
              return course ? (
                <Badge key={courseId} variant="secondary">
                  {course.title}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveCourse(courseId)}
                    aria-label={t('pages.skills.form.removeCourse', {
                      name: course.title,
                    })}
                    className="ml-xs h-4 w-4"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </Badge>
              ) : null;
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
