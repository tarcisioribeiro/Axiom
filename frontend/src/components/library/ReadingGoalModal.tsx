import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
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
import type { ReadingGoal } from '@/types';

interface ReadingGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ReadingGoalFormData) => void;
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
      ? { year: goal.year, books_goal: goal.books_goal, owner: goal.owner }
      : { year: currentYear, books_goal: 12, owner: 0 },
  });

  useEffect(() => {
    if (goal) {
      reset({ year: goal.year, books_goal: goal.books_goal, owner: goal.owner });
    } else {
      reset({ year: currentYear, books_goal: 12, owner: 0 });
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {goal ? 'Editar Meta de Leitura' : 'Nova Meta de Leitura'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
