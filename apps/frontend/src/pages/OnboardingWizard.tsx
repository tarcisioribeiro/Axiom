/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Dumbbell,
  Heart,
  Rocket,
  Sparkles,
  Star,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { routineTemplatesService } from '@/services/routine-templates-service';
import type { RoutineTemplate } from '@/types';

const FOCUS_AREAS = [
  {
    id: 'health',
    label: 'Saúde',
    icon: Heart,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10 border-rose-500/30',
  },
  {
    id: 'exercise',
    label: 'Exercício',
    icon: Dumbbell,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10 border-orange-500/30',
  },
  {
    id: 'productivity',
    label: 'Produtividade',
    icon: Rocket,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10 border-blue-500/30',
  },
  {
    id: 'learning',
    label: 'Aprendizado',
    icon: Brain,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10 border-purple-500/30',
  },
  {
    id: 'finance',
    label: 'Finanças',
    icon: DollarSign,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
  },
  {
    id: 'wellness',
    label: 'Bem-estar',
    icon: Star,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
  },
] as const;

type FocusAreaId = (typeof FOCUS_AREAS)[number]['id'];

const DAILY_TIME_OPTIONS = [
  { value: 30, label: '30 min', description: 'Rotina mínima' },
  { value: 60, label: '1 hora', description: 'Rotina leve' },
  { value: 90, label: '1h 30min', description: 'Rotina moderada' },
  { value: 120, label: '2+ horas', description: 'Rotina completa' },
];

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const STEPS = ['Objetivos', 'Tempo', 'Dias', 'Rotina'];

function matchesTemplate(
  template: RoutineTemplate,
  focusAreas: FocusAreaId[]
): boolean {
  const name = template.name.toLowerCase();
  const desc = template.description.toLowerCase();
  return focusAreas.some((area) => {
    switch (area) {
      case 'health':
        return name.includes('saúde') || desc.includes('saúde');
      case 'exercise':
        return (
          name.includes('treino') || name.includes('exerc') || desc.includes('exerc')
        );
      case 'productivity':
        return name.includes('produt') || desc.includes('produt');
      case 'learning':
        return (
          name.includes('aprendiz') ||
          name.includes('leitura') ||
          desc.includes('estud')
        );
      case 'finance':
        return name.includes('financ') || desc.includes('financ');
      case 'wellness':
        return (
          name.includes('bem-estar') ||
          desc.includes('bem-estar') ||
          name.includes('mental')
        );
      default:
        return true;
    }
  });
}

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [focusAreas, setFocusAreas] = useState<FocusAreaId[]>([]);
  const [dailyMinutes, setDailyMinutes] = useState<number>(60);
  const [activeDays, setActiveDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  const { data: templates = [] } = useQuery({
    queryKey: ['routine-templates'],
    queryFn: () => routineTemplatesService.getAll(),
    staleTime: 300_000,
  });

  const suggestedTemplates = templates.filter((t) =>
    focusAreas.length === 0 ? true : matchesTemplate(t, focusAreas)
  );

  const importMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await routineTemplatesService.importTemplate(id);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routine-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['daily-checklist'] });
      void queryClient.invalidateQueries({ queryKey: ['routine-templates'] });
      toast({
        title: 'Rotina criada com sucesso!',
        description: 'Redirecionando para a tela Hoje...',
      });
      setTimeout(() => void navigate('/planning/today'), 1500);
    },
    onError: () => {
      toast({ title: 'Erro ao importar templates', variant: 'destructive' });
    },
  });

  const toggleFocus = (id: FocusAreaId) => {
    setFocusAreas((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const toggleDay = (day: number) => {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const toggleTemplate = (id: string) => {
    setSelectedTemplates((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const canNext = (): boolean => {
    switch (step) {
      case 0:
        return focusAreas.length > 0;
      case 1:
        return true;
      case 2:
        return activeDays.length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleFinish = () => {
    if (selectedTemplates.length > 0) {
      importMutation.mutate(selectedTemplates);
    } else {
      void navigate('/planning/today');
    }
  };

  return (
    <AnimatedPage>
      <div className="bg-background p-lg flex min-h-screen flex-col items-center justify-center">
        <div className="w-full max-w-2xl">
          {/* Progress header */}
          <div className="mb-xl">
            <div className="mb-md flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Etapa {step + 1} de {STEPS.length}
              </p>
              <p className="text-sm font-medium">{STEPS[step]}</p>
            </div>
            <div className="gap-xs flex">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-all duration-300',
                    i <= step ? 'bg-primary' : 'bg-muted'
                  )}
                />
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && (
                <StepGoals focusAreas={focusAreas} onToggle={toggleFocus} />
              )}
              {step === 1 && (
                <StepTime dailyMinutes={dailyMinutes} onChange={setDailyMinutes} />
              )}
              {step === 2 && <StepDays activeDays={activeDays} onToggle={toggleDay} />}
              {step === 3 && (
                <StepRoutine
                  suggestedTemplates={suggestedTemplates}
                  selectedTemplates={selectedTemplates}
                  onToggle={toggleTemplate}
                  focusAreas={focusAreas}
                  dailyMinutes={dailyMinutes}
                  activeDays={activeDays}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-xl flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() =>
                step === 0 ? navigate('/planning/today') : setStep((s) => s - 1)
              }
            >
              {step === 0 ? (
                'Pular configuração'
              ) : (
                <>
                  <ChevronLeft className="mr-xs h-4 w-4" />
                  Anterior
                </>
              )}
            </Button>

            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
                Próximo
                <ChevronRight className="ml-xs h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={importMutation.isPending}>
                {importMutation.isPending ? (
                  'Criando sua rotina...'
                ) : (
                  <>
                    <Sparkles className="mr-xs h-4 w-4" />
                    {selectedTemplates.length > 0
                      ? 'Criar Minha Rotina'
                      : 'Começar sem rotina'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}

function StepGoals({
  focusAreas,
  onToggle,
}: {
  focusAreas: FocusAreaId[];
  onToggle: (id: FocusAreaId) => void;
}) {
  return (
    <div className="space-y-lg">
      <div>
        <h1 className="text-2xl font-bold">Quais são seus objetivos?</h1>
        <p className="mt-xs text-muted-foreground">
          Selecione as áreas que você quer desenvolver. Isso vai personalizar sua
          rotina.
        </p>
      </div>
      <div className="gap-md grid grid-cols-2 sm:grid-cols-3">
        {FOCUS_AREAS.map((area) => {
          const Icon = area.icon;
          const isSelected = focusAreas.includes(area.id);
          return (
            <button
              key={area.id}
              type="button"
              onClick={() => onToggle(area.id)}
              className={cn(
                'gap-sm p-md flex flex-col items-center rounded-lg border transition-all',
                isSelected
                  ? area.bg + ' ring-primary/30 ring-2'
                  : 'border-border bg-card hover:border-primary/30'
              )}
            >
              <Icon
                className={cn(
                  'h-7 w-7',
                  isSelected ? area.color : 'text-muted-foreground'
                )}
              />
              <span
                className={cn(
                  'text-sm font-medium',
                  isSelected ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {area.label}
              </span>
              {isSelected && <CheckCircle2 className="text-primary h-4 w-4" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepTime({
  dailyMinutes,
  onChange,
}: {
  dailyMinutes: number;
  onChange: (m: number) => void;
}) {
  return (
    <div className="space-y-lg">
      <div>
        <h1 className="text-2xl font-bold">Quanto tempo você tem por dia?</h1>
        <p className="mt-xs text-muted-foreground">
          Isso vai determinar quantas tarefas sugerimos na sua rotina diária.
        </p>
      </div>
      <div className="gap-md grid grid-cols-2">
        {DAILY_TIME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'gap-xs p-md flex flex-col items-start rounded-lg border text-left transition-all',
              dailyMinutes === opt.value
                ? 'border-primary bg-primary/5 ring-primary/20 ring-2'
                : 'border-border bg-card hover:border-primary/30'
            )}
          >
            <div className="flex w-full items-center justify-between">
              <Clock
                className={cn(
                  'h-5 w-5',
                  dailyMinutes === opt.value ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              {dailyMinutes === opt.value && (
                <CheckCircle2 className="text-primary h-4 w-4" />
              )}
            </div>
            <p
              className={cn(
                'text-lg font-bold',
                dailyMinutes === opt.value ? 'text-primary' : ''
              )}
            >
              {opt.label}
            </p>
            <p className="text-muted-foreground text-sm">{opt.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepDays({
  activeDays,
  onToggle,
}: {
  activeDays: number[];
  onToggle: (day: number) => void;
}) {
  return (
    <div className="space-y-lg">
      <div>
        <h1 className="text-2xl font-bold">Quais dias você quer ser ativo?</h1>
        <p className="mt-xs text-muted-foreground">
          Sua rotina será gerada apenas para os dias selecionados.
        </p>
      </div>
      <div className="gap-sm flex">
        {WEEKDAY_LABELS.map((label, idx) => {
          const isActive = activeDays.includes(idx);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onToggle(idx)}
              className={cn(
                'gap-xs py-md flex flex-1 flex-col items-center rounded-lg border transition-all',
                isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/30'
              )}
            >
              <span className="text-xs font-semibold">{label}</span>
              {isActive && <CheckCircle2 className="h-3 w-3" />}
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground text-sm">
        {activeDays.length} dia{activeDays.length !== 1 ? 's' : ''} selecionado
        {activeDays.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

function StepRoutine({
  suggestedTemplates,
  selectedTemplates,
  onToggle,
  focusAreas,
  dailyMinutes,
  activeDays,
}: {
  suggestedTemplates: RoutineTemplate[];
  selectedTemplates: string[];
  onToggle: (id: string) => void;
  focusAreas: FocusAreaId[];
  dailyMinutes: number;
  activeDays: number[];
}) {
  const activeDayNames = activeDays.map((d) => WEEKDAY_LABELS[d]).join(', ');
  const timeLabel =
    DAILY_TIME_OPTIONS.find((o) => o.value === dailyMinutes)?.label ??
    `${dailyMinutes}min`;

  return (
    <div className="space-y-lg">
      <div>
        <h1 className="text-2xl font-bold">Sua rotina personalizada</h1>
        <p className="mt-xs text-muted-foreground">
          Baseado nas suas escolhas, sugerimos estes templates. Selecione os que quiser
          importar.
        </p>
      </div>

      {/* Summary card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="gap-md p-md flex flex-wrap">
          <div className="gap-xs flex items-center">
            <Activity className="text-primary h-4 w-4" />
            <span className="text-sm">
              <strong>{focusAreas.length}</strong> área
              {focusAreas.length !== 1 ? 's' : ''} de foco
            </span>
          </div>
          <div className="gap-xs flex items-center">
            <Clock className="text-primary h-4 w-4" />
            <span className="text-sm">
              <strong>{timeLabel}</strong>/dia
            </span>
          </div>
          <div className="gap-xs flex items-center">
            <CheckCircle2 className="text-primary h-4 w-4" />
            <span className="text-sm">
              <strong>{activeDays.length}</strong> dias: {activeDayNames}
            </span>
          </div>
        </CardContent>
      </Card>

      {suggestedTemplates.length === 0 ? (
        <p className="text-muted-foreground text-center text-sm">
          Nenhum template encontrado para as áreas selecionadas.
        </p>
      ) : (
        <div className="space-y-sm">
          {suggestedTemplates.map((template) => {
            const isSelected = selectedTemplates.includes(template.id);
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => onToggle(template.id)}
                className={cn(
                  'gap-md p-md flex w-full items-center rounded-lg border text-left transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-primary/20 ring-1'
                    : 'border-border bg-card hover:border-primary/30'
                )}
              >
                <span className="shrink-0 text-2xl">{template.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{template.name}</p>
                  <p className="text-muted-foreground truncate text-sm">
                    {template.description}
                  </p>
                </div>
                <div className="gap-sm flex shrink-0 items-center">
                  <Badge variant="secondary">{template.task_count} tarefas</Badge>
                  {isSelected && <CheckCircle2 className="text-primary h-5 w-5" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
