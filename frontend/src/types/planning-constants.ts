export const TASK_CATEGORIES = [
  { value: 'health', label: 'Saúde' },
  { value: 'intellect', label: 'Intelecto' },
  { value: 'spiritual', label: 'Espiritual' },
  { value: 'exercise', label: 'Exercício Físico' },
  { value: 'nutrition', label: 'Nutrição' },
  { value: 'work', label: 'Trabalho' },
  { value: 'social', label: 'Social' },
  { value: 'finance', label: 'Finanças' },
  { value: 'household', label: 'Casa' },
  { value: 'personal_care', label: 'Cuidado Pessoal' },
  { value: 'other', label: 'Outros' },
] as const;

export const PERIODICITY_CHOICES = [
  { value: 'daily', label: 'Diária' },
  { value: 'weekdays', label: 'Dias Úteis' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'custom', label: 'Personalizado' },
] as const;

export const WEEKDAY_CHOICES = [
  { value: 0, label: 'Segunda-feira' },
  { value: 1, label: 'Terça-feira' },
  { value: 2, label: 'Quarta-feira' },
  { value: 3, label: 'Quinta-feira' },
  { value: 4, label: 'Sexta-feira' },
  { value: 5, label: 'Sábado' },
  { value: 6, label: 'Domingo' },
] as const;

export const GOAL_TYPE_CHOICES = [
  { value: 'consecutive_days', label: 'Dias Consecutivos' },
  { value: 'total_days', label: 'Total de Dias' },
  { value: 'avoid_habit', label: 'Evitar Hábito' },
  { value: 'custom', label: 'Personalizado' },
] as const;

export const GOAL_STATUS_CHOICES = [
  { value: 'active', label: 'Ativo' },
  { value: 'completed', label: 'Concluído' },
  { value: 'failed', label: 'Falhou' },
  { value: 'cancelled', label: 'Cancelado' },
] as const;

export const MOOD_CHOICES = [
  { value: 'excellent', label: 'Excelente' },
  { value: 'good', label: 'Bom' },
  { value: 'neutral', label: 'Neutro' },
  { value: 'bad', label: 'Ruim' },
  { value: 'terrible', label: 'Péssimo' },
] as const;

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export const PRIORITY_CHOICES = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
] as const;

export const UNIT_CHOICES = [
  { value: 'vez', label: 'vez' },
  { value: 'minuto', label: 'minuto' },
  { value: 'hora', label: 'hora' },
  { value: 'ml', label: 'ml' },
  { value: 'copo', label: 'copo' },
  { value: 'litro', label: 'litro' },
  { value: 'página', label: 'página' },
  { value: 'km', label: 'km' },
  { value: 'metro', label: 'metro' },
  { value: 'passo', label: 'passo' },
  { value: 'repetição', label: 'repetição' },
  { value: 'série', label: 'série' },
  { value: 'capítulo', label: 'capítulo' },
  { value: 'exercício', label: 'exercício' },
  { value: 'dose', label: 'dose' },
  { value: 'comprimido', label: 'comprimido' },
] as const;

export const INSTANCE_STATUS_CHOICES = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em Andamento' },
  { value: 'completed', label: 'Concluída' },
  { value: 'skipped', label: 'Pulada' },
  { value: 'cancelled', label: 'Cancelada' },
] as const;

export type InstanceStatus = (typeof INSTANCE_STATUS_CHOICES)[number]['value'];

export type KanbanStatus = 'todo' | 'doing' | 'done';
