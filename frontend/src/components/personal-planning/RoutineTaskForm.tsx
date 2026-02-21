import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { type z } from 'zod';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { IconPicker } from '@/components/ui/icon-picker';
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
import { formatLocalDate } from '@/lib/utils';
import { routineTaskSchema } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import {
  TASK_CATEGORIES,
  PERIODICITY_CHOICES,
  WEEKDAY_CHOICES,
  type RoutineTask,
} from '@/types';

type RoutineTaskFormData = z.infer<typeof routineTaskSchema>;

interface RoutineTaskFormProps {
  task?: RoutineTask;
  onSubmit: (data: RoutineTaskFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function RoutineTaskForm({
  task,
  onSubmit,
  onCancel,
  isLoading = false,
}: RoutineTaskFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RoutineTaskFormData>({
    resolver: zodResolver(routineTaskSchema),
    defaultValues: task
      ? {
          name: task.name,
          description: task.description || '',
          category: task.category,
          icon: task.icon || null,
          periodicity: task.periodicity,
          weekday: task.weekday,
          day_of_month: task.day_of_month,
          is_active: task.is_active,
          target_quantity: task.target_quantity,
          unit: task.unit,
          owner: task.owner,
          default_time: task.default_time || null,
          daily_occurrences: task.daily_occurrences || 1,
          interval_hours: task.interval_hours || null,
          scheduled_times: task.scheduled_times || null,
        }
      : {
          name: '',
          description: '',
          category: 'health',
          icon: null,
          periodicity: 'daily',
          weekday: undefined,
          day_of_month: undefined,
          is_active: true,
          target_quantity: 1,
          unit: 'vez',
          owner: 0,
          default_time: null,
          daily_occurrences: 1,
          interval_hours: null,
          scheduled_times: null,
        },
  });

  const periodicity = watch('periodicity');
  const isActive = watch('is_active');

  // Load current user member when creating new task
  useEffect(() => {
    const loadCurrentUserMember = async () => {
      if (!task) {
        try {
          const member = await membersService.getCurrentUserMember();
          setValue('owner', member.id);
        } catch (error) {
          console.error('Erro ao carregar membro do usuário:', error);
        }
      }
    };

    void loadCurrentUserMember();
  }, [task, setValue]);

  // Reset conditional fields when periodicity changes
  useEffect(() => {
    if (periodicity === 'daily') {
      setValue('weekday', undefined);
      setValue('day_of_month', undefined);
    } else if (periodicity === 'weekly') {
      setValue('day_of_month', undefined);
      if (watch('weekday') === undefined) {
        setValue('weekday', 0); // Default to Monday
      }
    } else if (periodicity === 'monthly') {
      setValue('weekday', undefined);
      if (watch('day_of_month') === undefined) {
        setValue('day_of_month', 1); // Default to day 1
      }
    }
  }, [periodicity, setValue, watch]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Nome da Tarefa *</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="Ex: Meditar, Exercitar-se, Estudar..."
          />
          {errors.name && (
            <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            {...register('description')}
            placeholder="Descrição da tarefa (opcional)"
            rows={3}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="category">Categoria *</Label>
          <Select
            value={watch('category')}
            onValueChange={(value) => setValue('category', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="mt-1 text-sm text-destructive">{errors.category.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="icon">Icone</Label>
          <IconPicker
            value={watch('icon')}
            onChange={(value) => setValue('icon', value)}
          />
          {errors.icon && (
            <p className="mt-1 text-sm text-destructive">{errors.icon.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="periodicity">Periodicidade *</Label>
          <Select
            value={watch('periodicity')}
            onValueChange={(value) => setValue('periodicity', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODICITY_CHOICES.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.periodicity && (
            <p className="mt-1 text-sm text-destructive">
              {errors.periodicity.message}
            </p>
          )}
        </div>

        {/* Conditional: Weekday (only for weekly tasks) */}
        {periodicity === 'weekly' && (
          <div className="col-span-2">
            <Label htmlFor="weekday">Dia da Semana *</Label>
            <Select
              value={watch('weekday')?.toString()}
              onValueChange={(value) => setValue('weekday', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o dia da semana" />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAY_CHOICES.map((day) => (
                  <SelectItem key={day.value} value={day.value.toString()}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.weekday && (
              <p className="mt-1 text-sm text-destructive">{errors.weekday.message}</p>
            )}
          </div>
        )}

        {/* Conditional: Day of Month (only for monthly tasks) */}
        {periodicity === 'monthly' && (
          <div className="col-span-2">
            <Label htmlFor="day_of_month">Dia do Mês *</Label>
            <Input
              id="day_of_month"
              type="number"
              min="1"
              max="31"
              {...register('day_of_month', {
                setValueAs: (value: string) =>
                  value === '' ? undefined : parseInt(value),
              })}
              placeholder="1-31"
            />
            {errors.day_of_month && (
              <p className="mt-1 text-sm text-destructive">
                {errors.day_of_month.message}
              </p>
            )}
          </div>
        )}

        {/* Conditional: Weekdays (only for weekdays tasks) */}
        {periodicity === 'weekdays' && (
          <div className="col-span-2">
            <p className="text-sm">Esta tarefa aparecerá de Segunda a Sexta-feira.</p>
          </div>
        )}

        {/* Conditional: Custom periodicity */}
        {periodicity === 'custom' && (
          <div className="col-span-2 space-y-4 rounded-lg border bg-muted/50 p-4">
            <h4 className="text-sm font-medium">Configuração Personalizada</h4>

            {/* Custom Weekdays */}
            <div>
              <Label className="text-sm">Dias da Semana (opcional)</Label>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {WEEKDAY_CHOICES.map((day) => (
                  <div key={day.value} className="flex flex-col items-center gap-1">
                    <Checkbox
                      id={`custom-weekday-${day.value}`}
                      checked={watch('custom_weekdays')?.includes(day.value) || false}
                      onCheckedChange={(checked) => {
                        const current = watch('custom_weekdays') || [];
                        setValue(
                          'custom_weekdays',
                          checked
                            ? [...current, day.value]
                            : current.filter((d) => d !== day.value)
                        );
                      }}
                    />
                    <Label
                      htmlFor={`custom-weekday-${day.value}`}
                      className="cursor-pointer text-xs"
                    >
                      {day.label.substring(0, 3)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Month Days */}
            <div>
              <Label htmlFor="custom_month_days" className="text-sm">
                Dias do Mês (opcional, separados por vírgula)
              </Label>
              <Input
                id="custom_month_days"
                type="text"
                placeholder="Ex: 1,15,30"
                value={watch('custom_month_days')?.join(',') || ''}
                onChange={(e) => {
                  const values = e.target.value
                    .split(',')
                    .map((v) => parseInt(v.trim()))
                    .filter((v) => !isNaN(v) && v >= 1 && v <= 31);
                  setValue('custom_month_days', values.length > 0 ? values : null);
                }}
              />
            </div>

            {/* Frequency Options */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="times_per_week" className="text-sm">
                  Vezes por Semana
                </Label>
                <Input
                  id="times_per_week"
                  type="number"
                  min="1"
                  max="7"
                  {...register('times_per_week', {
                    setValueAs: (value: string) =>
                      value === '' ? null : parseInt(value),
                  })}
                  placeholder="1-7"
                />
              </div>
              <div>
                <Label htmlFor="times_per_month" className="text-sm">
                  Vezes por Mês
                </Label>
                <Input
                  id="times_per_month"
                  type="number"
                  min="1"
                  max="31"
                  {...register('times_per_month', {
                    setValueAs: (value: string) =>
                      value === '' ? null : parseInt(value),
                  })}
                  placeholder="1-31"
                />
              </div>
            </div>

            {/* Interval Options */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="interval_days" className="text-sm">
                  A cada X dias
                </Label>
                <Input
                  id="interval_days"
                  type="number"
                  min="1"
                  {...register('interval_days', {
                    setValueAs: (value: string) =>
                      value === '' ? null : parseInt(value),
                  })}
                  placeholder="Ex: 3"
                />
              </div>
              <div>
                <Label htmlFor="interval_start_date" className="text-sm">
                  Data de Início
                </Label>
                <DatePicker
                  value={watch('interval_start_date') ?? undefined}
                  onChange={(date) =>
                    setValue(
                      'interval_start_date',
                      date ? formatLocalDate(date) : undefined
                    )
                  }
                  placeholder="Selecione a data de início"
                />
              </div>
            </div>

            {errors.interval_start_date && (
              <p className="text-sm text-destructive">
                {errors.interval_start_date.message}
              </p>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="target_quantity">Quantidade Alvo *</Label>
          <Input
            id="target_quantity"
            type="number"
            min="1"
            {...register('target_quantity', {
              setValueAs: (value: string) => (value === '' ? 1 : parseInt(value)),
            })}
          />
          {errors.target_quantity && (
            <p className="mt-1 text-sm text-destructive">
              {errors.target_quantity.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="unit">Unidade *</Label>
          <Input
            id="unit"
            {...register('unit')}
            placeholder="Ex: vez, minutos, páginas..."
          />
          {errors.unit && (
            <p className="mt-1 text-sm text-destructive">{errors.unit.message}</p>
          )}
        </div>

        {/* Seção de Agendamento de Horários */}
        <div className="col-span-2 space-y-4 rounded-lg border bg-muted/50 p-4">
          <h4 className="text-sm font-medium">Agendamento de Horários</h4>
          <p className="text-xs">
            Configure horários específicos para cada ocorrência da tarefa no dia.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="default_time">Horário Padrão</Label>
              <Input
                id="default_time"
                type="time"
                value={watch('default_time') || ''}
                onChange={(e) => setValue('default_time', e.target.value || null)}
              />
              <p className="mt-1 text-xs">Horário base para todas as ocorrências</p>
              {errors.default_time && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.default_time.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="daily_occurrences">Ocorrências por Dia</Label>
              <Input
                id="daily_occurrences"
                type="number"
                min="1"
                max="24"
                {...register('daily_occurrences', {
                  setValueAs: (value: string) => (value === '' ? 1 : parseInt(value)),
                })}
              />
              <p className="mt-1 text-xs">Quantas vezes no dia (1-24)</p>
            </div>
          </div>

          <div>
            <Label htmlFor="interval_hours">Intervalo entre Repetições (horas)</Label>
            <Input
              id="interval_hours"
              type="number"
              min="1"
              max="12"
              value={watch('interval_hours') || ''}
              onChange={(e) =>
                setValue(
                  'interval_hours',
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              placeholder="Ex: 4 (a cada 4 horas)"
            />
            <p className="mt-1 text-xs">
              Requer horário padrão. Ex: Horário padrão 8:00 + intervalo 4h = 8:00,
              12:00, 16:00...
            </p>
            {errors.interval_hours && (
              <p className="mt-1 text-sm text-destructive">
                {errors.interval_hours.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="scheduled_times">Horários Específicos</Label>
            <Input
              id="scheduled_times"
              type="text"
              placeholder="Ex: 08:00, 12:00, 18:00"
              value={watch('scheduled_times')?.join(', ') || ''}
              onChange={(e) => {
                const times = e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter((t) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(t));
                setValue('scheduled_times', times.length > 0 ? times : null);
              }}
            />
            <p className="mt-1 text-xs">
              Sobrescreve intervalo. Separe por vírgula (HH:MM)
            </p>
            {errors.scheduled_times && (
              <p className="mt-1 text-sm text-destructive">
                {errors.scheduled_times.message}
              </p>
            )}
          </div>
        </div>

        <div className="col-span-2 flex items-center space-x-2">
          <Checkbox
            id="is_active"
            checked={isActive}
            onCheckedChange={(checked) => setValue('is_active', checked as boolean)}
          />
          <Label
            htmlFor="is_active"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Tarefa Ativa
          </Label>
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
