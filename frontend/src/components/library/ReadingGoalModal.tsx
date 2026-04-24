import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { startTransition, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logger } from '@/lib/logger';
import { readingGoalSchema, type ReadingGoalFormData } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import type { LiteraryTypeGoal, ReadingGoal } from '@/types';

const LITERARY_TYPES = [
  { value: 'book', label: 'Livro' },
  { value: 'collection', label: 'Coletânea' },
  { value: 'magazine', label: 'Revista' },
  { value: 'article', label: 'Artigo' },
  { value: 'essay', label: 'Ensaio' },
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
  const availableTypes = LITERARY_TYPES.filter((t) => !usedTypes.has(t.value));

  const addLtg = () => {
    if (availableTypes.length === 0) return;
    setLtgDrafts((prev) => [
      ...prev,
      { literary_type: availableTypes[0].value, goal_count: 1 },
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
            {goal ? 'Editar Meta de Leitura' : 'Nova Meta de Leitura'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="year">Ano *</Label>
            <Input
              id="year"
              type="number"
              min={2000}
              max={2100}
              {...register('year', {
                setValueAs: (v: string) => (v === '' ? 0 : parseInt(v)),
              })}
            />
            {errors.year && (
              <p className="text-sm text-destructive">{errors.year.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome da Meta</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Ex: Meta de Férias, Clássicos..."
            />
            <p className="text-xs text-muted-foreground">
              Opcional — útil quando há múltiplas metas no mesmo ano
            </p>
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="books_goal">Meta de Livros *</Label>
            <Input
              id="books_goal"
              type="number"
              min={1}
              max={365}
              {...register('books_goal', {
                setValueAs: (v: string) => (v === '' ? 0 : parseInt(v)),
              })}
            />
            <p className="text-xs text-muted-foreground">
              Quantos livros você quer ler em {new Date().getFullYear()}?
            </p>
            {errors.books_goal && (
              <p className="text-sm text-destructive">{errors.books_goal.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pages_goal">Meta de Páginas</Label>
            <Input
              id="pages_goal"
              type="number"
              min={0}
              max={100000}
              {...register('pages_goal', {
                setValueAs: (v: string) => (v === '' ? 0 : parseInt(v)),
              })}
              placeholder="0 = sem meta de páginas"
            />
            <p className="text-xs text-muted-foreground">
              Quantas páginas você quer ler? (opcional)
            </p>
            {errors.pages_goal && (
              <p className="text-sm text-destructive">{errors.pages_goal.message}</p>
            )}
          </div>

          {/* Metas por tipo literário */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Metas por Tipo Literário</Label>
              {availableTypes.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLtg}
                  className="h-7 gap-1 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Adicionar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Defina metas individuais para artigos, revistas, ensaios, etc. (opcional)
            </p>

            {ltgDrafts.length > 0 && (
              <div className="space-y-2">
                {ltgDrafts.map((draft, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                      value={draft.literary_type}
                      onChange={(e) =>
                        updateLtg(index, 'literary_type', e.target.value)
                      }
                    >
                      {/* Show current value + available options */}
                      {LITERARY_TYPES.filter(
                        (t) =>
                          t.value === draft.literary_type ||
                          !usedTypes.has(t.value) ||
                          ltgDrafts.findIndex(
                            (d, i) => i !== index && d.literary_type === t.value
                          ) === -1
                      ).map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
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

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
