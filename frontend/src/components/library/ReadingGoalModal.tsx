/* eslint-disable max-lines */
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, Loader2, Plus, Tag, Target, Trash2 } from 'lucide-react';
import { startTransition, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BOOK_LITERARY_TYPE_ICONS } from '@/config/icons';
import { logger } from '@/lib/logger';
import { readingGoalSchema, type ReadingGoalFormData } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import type { LiteraryTypeGoal, ReadingGoal } from '@/types';

const LITERARY_TYPE_GOAL_VALUES = [
  'collection',
  'magazine',
  'article',
  'essay',
] as const;

export interface LiteraryTypeGoalDraft {
  id?: number;
  literary_type: string;
  goal_count: number;
}

interface ReadingGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ReadingGoalFormData, ltgDrafts: LiteraryTypeGoalDraft[]) => void;
  goal?: ReadingGoal;
  isLoading?: boolean;
}

export function ReadingGoalModal({
  isOpen,
  onClose,
  onSubmit,
  goal,
  isLoading = false,
}: ReadingGoalModalProps) {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ReadingGoalFormData>({
    resolver: zodResolver(readingGoalSchema),
    defaultValues: goal
      ? {
          year: goal.year,
          name: goal.name ?? '',
          books_goal: goal.books_goal,
          pages_goal: goal.pages_goal,
          owner: goal.owner,
        }
      : { year: currentYear, name: '', books_goal: 12, pages_goal: 0, owner: 0 },
  });

  const [ltgDrafts, setLtgDrafts] = useState<LiteraryTypeGoalDraft[]>([]);

  useEffect(() => {
    if (goal) {
      reset({
        year: goal.year,
        name: goal.name ?? '',
        books_goal: goal.books_goal,
        pages_goal: goal.pages_goal,
        owner: goal.owner,
      });
      startTransition(() => {
        setLtgDrafts(
          (goal.literary_type_goals ?? []).map((g: LiteraryTypeGoal) => ({
            id: g.id,
            literary_type: g.literary_type,
            goal_count: g.goal_count,
          }))
        );
      });
    } else {
      reset({ year: currentYear, name: '', books_goal: 12, pages_goal: 0, owner: 0 });
      startTransition(() => setLtgDrafts([]));
      const loadMember = async () => {
        try {
          const member = await membersService.getCurrentUserMember();
          setValue('owner', member.id);
        } catch (error) {
          logger.error('Erro ao carregar membro:', error);
        }
      };
      void loadMember();
    }
  }, [goal, reset, setValue, currentYear]);

  const usedTypes = new Set(ltgDrafts.map((d) => d.literary_type));
  const availableValues = LITERARY_TYPE_GOAL_VALUES.filter((v) => !usedTypes.has(v));

  const addLtg = () => {
    if (availableValues.length === 0) return;
    setLtgDrafts((prev) => [
      ...prev,
      { literary_type: availableValues[0], goal_count: 1 },
    ]);
  };

  const removeLtg = (index: number) => {
    setLtgDrafts((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLtg = (
    index: number,
    field: keyof LiteraryTypeGoalDraft,
    value: string | number
  ) => {
    setLtgDrafts((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  };

  const handleFormSubmit = (data: ReadingGoalFormData) => {
    onSubmit(data, ltgDrafts);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {goal
              ? t('pages.libraryDashboard.readingGoals.editTitle')
              : t('pages.libraryDashboard.readingGoals.newTitle')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg">
          <FormSection
            title={t('pages.libraryDashboard.readingGoals.sectionGoal')}
            icon={Target}
          >
            <div className="grid grid-cols-1 gap-md md:grid-cols-2">
              <div className="space-y-sm">
                <Label htmlFor="year" className="flex items-center gap-xs">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('pages.libraryDashboard.readingGoals.formYear')}
                </Label>
                <Input
                  id="year"
                  type="number"
                  min={2000}
                  max={2100}
                  {...register('year', {
                    setValueAs: (v: string) => (v === '' ? 0 : parseInt(v)),
                  })}
                  disabled={isLoading}
                />
                {errors.year && (
                  <p className="text-sm text-destructive">{errors.year.message}</p>
                )}
              </div>

              <div className="space-y-sm">
                <Label htmlFor="name" className="flex items-center gap-xs">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('pages.libraryDashboard.readingGoals.formName')}
                </Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder={t(
                    'pages.libraryDashboard.readingGoals.formNamePlaceholder'
                  )}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  {t('pages.libraryDashboard.readingGoals.formNameHint')}
                </p>
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
            </div>
          </FormSection>

          <FormSection
            title={t('pages.libraryDashboard.readingGoals.sectionQuantities')}
            icon={BookOpen}
          >
            <div className="grid grid-cols-1 gap-md md:grid-cols-2">
              <div className="space-y-sm">
                <Label htmlFor="books_goal" className="flex items-center gap-xs">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('pages.libraryDashboard.readingGoals.formBooksGoal')}
                </Label>
                <Input
                  id="books_goal"
                  type="number"
                  min={1}
                  max={365}
                  {...register('books_goal', {
                    setValueAs: (v: string) => (v === '' ? 0 : parseInt(v)),
                  })}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  {t('pages.libraryDashboard.readingGoals.formBooksGoalHint', {
                    year: currentYear,
                  })}
                </p>
                {errors.books_goal && (
                  <p className="text-sm text-destructive">
                    {errors.books_goal.message}
                  </p>
                )}
              </div>

              <div className="space-y-sm">
                <Label htmlFor="pages_goal" className="flex items-center gap-xs">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('pages.libraryDashboard.readingGoals.formPagesGoal')}
                </Label>
                <Input
                  id="pages_goal"
                  type="number"
                  min={0}
                  max={100000}
                  {...register('pages_goal', {
                    setValueAs: (v: string) => (v === '' ? 0 : parseInt(v)),
                  })}
                  placeholder={t(
                    'pages.libraryDashboard.readingGoals.formPagesGoalPlaceholder'
                  )}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  {t('pages.libraryDashboard.readingGoals.formPagesGoalHint')}
                </p>
                {errors.pages_goal && (
                  <p className="text-sm text-destructive">
                    {errors.pages_goal.message}
                  </p>
                )}
              </div>
            </div>
          </FormSection>

          <FormSection
            title={t('pages.libraryDashboard.readingGoals.formLiteraryTypesLabel')}
            icon={Tag}
          >
            <div className="space-y-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {t('pages.libraryDashboard.readingGoals.formLiteraryTypesHint')}
                </p>
                {availableValues.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLtg}
                    className="h-7 gap-xs text-xs"
                    disabled={isLoading}
                  >
                    <Plus className="h-3 w-3" />
                    {t('pages.libraryDashboard.readingGoals.formAddType')}
                  </Button>
                )}
              </div>

              {ltgDrafts.length > 0 && (
                <div className="space-y-sm">
                  {ltgDrafts.map((draft, index) => (
                    <div key={index} className="flex items-center gap-sm">
                      <select
                        className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-xs text-sm shadow-sm"
                        value={draft.literary_type}
                        onChange={(e) =>
                          updateLtg(index, 'literary_type', e.target.value)
                        }
                      >
                        {LITERARY_TYPE_GOAL_VALUES.filter(
                          (v) =>
                            v === draft.literary_type ||
                            !usedTypes.has(v) ||
                            ltgDrafts.findIndex(
                              (d, i) => i !== index && d.literary_type === v
                            ) === -1
                        ).map((v) => (
                          <option key={v} value={v}>
                            {(() => {
                              const LitIcon = BOOK_LITERARY_TYPE_ICONS[v];
                              return LitIcon ? (
                                <LitIcon className="mr-1 inline h-4 w-4" />
                              ) : null;
                            })()}
                            {t(
                              `pages.libraryDashboard.readingGoals.literaryTypes.${v}`
                            )}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min={1}
                        max={500}
                        className="w-24"
                        value={draft.goal_count}
                        onChange={(e) =>
                          updateLtg(
                            index,
                            'goal_count',
                            e.target.value === '' ? 1 : parseInt(e.target.value)
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-destructive"
                        onClick={() => removeLtg(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FormSection>

          <div className="flex justify-end gap-sm border-t pt-md">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-sm h-4 w-4 animate-spin" />
                  {t('common.actions.saving')}
                </>
              ) : (
                t('common.actions.save')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
