/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Atom,
  Brain,
  Briefcase,
  Code2,
  Globe,
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
import { cn } from '@/lib/utils';
import type {
  IntellectCategory,
  Skill,
  SkillFormData,
  SkillProficiency,
  SkillStatus,
} from '@/types';

const skillSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  proficiency: z.string().min(1),
  status: z.string().min(1),
  notes: z.string().optional().nullable(),
  owner: z.number(),
});

type SkillFormValues = z.infer<typeof skillSchema>;

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

const CATEGORY_ICONS: Record<IntellectCategory, LucideIcon> = {
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
  learning:
    'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  evolving:
    'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  mastered:
    'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
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
    <div className="grid grid-cols-5 gap-sm">
      {PROFICIENCY_LEVELS.map(({ value: lvl, dots }) => (
        <button
          key={lvl}
          type="button"
          onClick={() => onChange(lvl)}
          className={cn(
            'flex flex-col items-center gap-xs rounded-lg border-2 p-sm transition-all',
            value === lvl
              ? 'border-category-intellect bg-category-intellect/10 shadow-sm'
              : 'border-border bg-background hover:border-category-intellect/40 hover:bg-category-intellect/5'
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
              'text-center text-[10px] font-medium leading-tight',
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

  const { register, handleSubmit, setValue, watch, reset } = useForm<SkillFormValues>({
    resolver: zodResolver(skillSchema),
    defaultValues: {
      name: '',
      category: 'technology',
      proficiency: 'beginner',
      status: 'learning',
      notes: null,
      owner: ownerId,
    },
  });

  useEffect(() => {
    if (skill) {
      reset({
        name: skill.name,
        category: skill.category,
        proficiency: skill.proficiency,
        status: skill.status,
        notes: skill.notes ?? null,
        owner: skill.owner,
      });
    } else {
      reset({
        name: '',
        category: 'technology',
        proficiency: 'beginner',
        status: 'learning',
        notes: null,
        owner: ownerId,
      });
    }
  }, [skill, ownerId, reset]);

  const handleFormSubmit = async (values: SkillFormValues) => {
    await onSubmit({
      name: values.name,
      category: values.category as IntellectCategory,
      proficiency: values.proficiency as SkillProficiency,
      status: values.status as SkillStatus,
      notes: values.notes || null,
      owner: values.owner,
    });
  };

  const currentStatus = watch('status') as SkillStatus;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg">
      <FormSection title={t('pages.skills.form.sectionInfo')} icon={Brain}>
        <div className="space-y-sm">
          <Label htmlFor="name">{t('pages.skills.form.nameLabel')}</Label>
          <Input
            id="name"
            placeholder={t('pages.skills.form.namePlaceholder')}
            {...register('name')}
          />
        </div>

        <div className="space-y-sm">
          <Label>{t('pages.skills.form.categoryLabel')}</Label>
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
          <Label>{t('pages.skills.form.proficiencyLabel')}</Label>
          <ProficiencySelector
            value={watch('proficiency')}
            onChange={(v) => setValue('proficiency', v)}
          />
        </div>

        <div className="space-y-sm">
          <Label>{t('pages.skills.form.statusLabel')}</Label>
          <div className="flex gap-sm">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setValue('status', s)}
                className={cn(
                  'flex-1 rounded-lg border-2 px-sm py-sm text-xs font-semibold transition-all',
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
          <Label htmlFor="notes">{t('pages.skills.form.notesLabel')}</Label>
          <Textarea
            id="notes"
            rows={2}
            placeholder={t('pages.skills.form.notesPlaceholder')}
            {...register('notes')}
          />
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
