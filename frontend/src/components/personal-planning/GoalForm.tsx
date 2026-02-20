import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { goalSchema } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import {
  GOAL_TYPE_CHOICES,
  GOAL_STATUS_CHOICES,
  type Goal,
  type RoutineTask,
} from '@/types';
import { type z } from 'zod';

import { formatLocalDate } from '@/lib/utils';
type GoalFormData = z.infer<typeof goalSchema>;

interface GoalFormProps {
  goal?: Goal;
  routineTasks: RoutineTask[];
  onSubmit: (data: GoalFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function GoalForm({
  goal,
  routineTasks,
  onSubmit,
  onCancel,
  isLoading = false,
}: GoalFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: goal
      ? {
          title: goal.title,
          description: goal.description || '',
          goal_type: goal.goal_type,
          related_task: goal.related_task,
          target_value: goal.target_value,
          current_value: goal.current_value,
          start_date: goal.start_date,
          end_date: goal.end_date || '',
          status: goal.status,
          owner: goal.owner,
        }
      : {
          title: '',
          description: '',
          goal_type: 'consecutive_days',
          related_task: undefined,
          target_value: 30,
          current_value: 0,
          start_date: formatLocalDate(new Date()),
          end_date: '',
          status: 'active',
          owner: 0,
        },
  });

  // Load current user member when creating new goal
  useEffect(() => {
    const loadCurrentUserMember = async () => {
      if (!goal) {
        try {
          const member = await membersService.getCurrentUserMember();
          setValue('owner', member.id);
        } catch (error) {
          console.error('Erro ao carregar membro do usuário:', error);
        }
      }
    };

    void loadCurrentUserMember();
  }, [goal, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="title">Título *</Label>
          <Input
            id="title"
            {...register('title')}
            placeholder="Ex: Meditar 30 dias consecutivos"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            {...register('description')}
            placeholder="Descrição do objetivo (opcional)"
            rows={3}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="goal_type">Tipo de Objetivo *</Label>
          <Select
            value={watch('goal_type')}
            onValueChange={(value) => setValue('goal_type', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_TYPE_CHOICES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.goal_type && (
            <p className="mt-1 text-sm text-destructive">{errors.goal_type.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="related_task">Tarefa Relacionada</Label>
          <Select
            value={watch('related_task')?.toString()}
            onValueChange={(value) =>
              setValue('related_task', value ? parseInt(value) : undefined)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Nenhuma tarefa selecionada" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {routineTasks.map((task) => (
                <SelectItem key={task.id} value={task.id.toString()}>
                  {task.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.related_task && (
            <p className="mt-1 text-sm text-destructive">
              {errors.related_task.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="target_value">Meta *</Label>
          <Input
            id="target_value"
            type="number"
            min="1"
            {...register('target_value', {
              setValueAs: (value: string) => (value === '' ? 1 : parseInt(value)),
            })}
          />
          {errors.target_value && (
            <p className="mt-1 text-sm text-destructive">
              {errors.target_value.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="current_value">Progresso Atual *</Label>
          <Input
            id="current_value"
            type="number"
            min="0"
            {...register('current_value', {
              setValueAs: (value: string) => (value === '' ? 0 : parseInt(value)),
            })}
          />
          {errors.current_value && (
            <p className="mt-1 text-sm text-destructive">
              {errors.current_value.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="start_date">Data de Início *</Label>
          <DatePicker
            value={watch('start_date')}
            onChange={(date) =>
              setValue('start_date', date ? formatLocalDate(date) : '')
            }
            placeholder="Selecione a data de início"
          />
          {errors.start_date && (
            <p className="mt-1 text-sm text-destructive">{errors.start_date.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="end_date">Data de Término</Label>
          <DatePicker
            value={watch('end_date')}
            onChange={(date) => setValue('end_date', date ? formatLocalDate(date) : '')}
            placeholder="Selecione a data de término"
          />
          {errors.end_date && (
            <p className="mt-1 text-sm text-destructive">{errors.end_date.message}</p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="status">Status *</Label>
          <Select
            value={watch('status')}
            onValueChange={(value) => setValue('status', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_STATUS_CHOICES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.status && (
            <p className="mt-1 text-sm text-destructive">{errors.status.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
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
  );
}
