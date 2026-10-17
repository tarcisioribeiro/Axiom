/* eslint-disable max-lines */
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, Plus, Tag, Target, Trash2, Save, X } from 'lucide-react';
import { startTransition, useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { NumberStepper } from '@/components/ui/number-stepper';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BOOK_LITERARY_TYPE_ICONS } from '@/config/icons';
import { notifyFormErrors } from '@/lib/form-errors';
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
    control,
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
          <DialogTitle mode={goal ? 'edit' : 'create'}>
            {goal
              ? t('pages.libraryDashboard.readingGoals.editTitle')
              : t('pages.libraryDashboard.readingGoals.newTitle')}
          </DialogTitle>
        </DialogHeader>

        <form
          noValidate
          onSubmit={handleSubmit(handleFormSubmit, notifyFormErrors)}
          className="space-y-lg"
        >
          <FormSection
            title={t('pages.libraryDashboard.readingGoals.sectionGoal')}
            icon={Target}
          >
            <div className="gap-md grid grid-cols-1 md:grid-cols-2">
              <div className="space-y-sm">
                <Label htmlFor="year" className="gap-xs flex items-center">
                  <Target className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.libraryDashboard.readingGoals.formYear')}
                </Label>
                <Controller
                  control={control}
                  name="year"
                  render={({ field }) => (
                    <NumberStepper
                      id="year"
                      aria-invalid={!!errors.year}
                      disabled={isLoading}
                      min={2000}
                      max={2100}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="space-y-sm">
                <Label htmlFor="name" className="gap-xs flex items-center">
                  <Target className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.libraryDashboard.readingGoals.formName')}
                </Label>
                <Input
                  id="name"
                  {...register('name')}
                  aria-invalid={!!errors.name}
                  placeholder={t(
                    'pages.libraryDashboard.readingGoals.formNamePlaceholder'
                  )}
                  disabled={isLoading}
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            title={t('pages.libraryDashboard.readingGoals.sectionQuantities')}
            icon={BookOpen}
          >
            <div className="gap-md grid grid-cols-1 md:grid-cols-2">
              <div className="space-y-sm">
                <Label htmlFor="books_goal" className="gap-xs flex items-center">
                  <BookOpen className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.libraryDashboard.readingGoals.formBooksGoal')}
                </Label>
                <Controller
                  control={control}
                  name="books_goal"
                  render={({ field }) => (
                    <NumberStepper
                      id="books_goal"
                      aria-invalid={!!errors.books_goal}
                      disabled={isLoading}
                      min={1}
                      max={365}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="space-y-sm">
                <Label htmlFor="pages_goal" className="gap-xs flex items-center">
                  <BookOpen className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.libraryDashboard.readingGoals.formPagesGoal')}
                </Label>
                <Controller
                  control={control}
                  name="pages_goal"
                  render={({ field }) => (
                    <NumberStepper
                      id="pages_goal"
                      aria-invalid={!!errors.pages_goal}
                      disabled={isLoading}
                      placeholder={t(
                        'pages.libraryDashboard.readingGoals.formPagesGoalPlaceholder'
                      )}
                      min={0}
                      max={100000}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            title={t('pages.libraryDashboard.readingGoals.formLiteraryTypesLabel')}
            icon={Tag}
          >
            <div className="space-y-sm">
              <div className="flex items-center justify-between">
                {availableValues.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLtg}
                    className="gap-xs h-7 text-xs"
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
                    <div key={index} className="gap-sm flex items-center">
                      <Select
                        value={draft.literary_type}
                        onValueChange={(v) => updateLtg(index, 'literary_type', v)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LITERARY_TYPE_GOAL_VALUES.filter(
                            (v) =>
                              v === draft.literary_type ||
                              !usedTypes.has(v) ||
                              ltgDrafts.findIndex(
                                (d, i) => i !== index && d.literary_type === v
                              ) === -1
                          ).map((v) => {
                            const LitIcon = BOOK_LITERARY_TYPE_ICONS[v];
                            return (
                              <SelectItem
                                key={v}
                                value={v}
                                icon={
                                  LitIcon ? <LitIcon className="h-4 w-4" /> : undefined
                                }
                              >
                                {t(
                                  `pages.libraryDashboard.readingGoals.literaryTypes.${v}`
                                )}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <NumberStepper
                        min={1}
                        max={500}
                        aria-label={t(
                          'pages.libraryDashboard.readingGoals.formBooksGoal'
                        )}
                        value={draft.goal_count}
                        onChange={(v) => updateLtg(index, 'goal_count', v ?? 1)}
                      />
                      <Button
                        aria-label={t('common.actions.remove')}
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-9 w-9 shrink-0"
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

          <div className="dialog-footer gap-sm pt-md flex justify-end border-t">
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
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
