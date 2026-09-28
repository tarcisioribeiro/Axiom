/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Droplets, Link2, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { formatLocalDate } from '@/lib/utils';
import { hydrationGoalService, waterLogService } from '@/services/nutrition-service';
import { getErrorMessage } from '@/utils/error-utils';

const QUICK_AMOUNTS_ML = [200, 250, 500];

const formatLiters = (ml: number) =>
  (ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function useHydrationDay(date: string) {
  const { data: goal } = useQuery({
    queryKey: ['hydration-goal'],
    queryFn: () => hydrationGoalService.get(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['water-logs', 'date', date],
    queryFn: () => waterLogService.getByDate(date),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
  const goalMl = goal?.daily_target_ml ?? null;
  const totalMl = logs.reduce((acc, log) => acc + log.amount_ml, 0);
  return { goalMl, totalMl, logs, isLoading };
}

/** "💧 1,8 / 3 L" — exibido ao lado do total de kcal. */
export function WaterTotal({ date }: { date: string }) {
  const { goalMl, totalMl } = useHydrationDay(date);
  return (
    <div className="text-right">
      <span className="inline-flex items-center gap-0.5 text-2xl font-bold text-sky-500 tabular-nums">
        <Droplets className="h-5 w-5" />
        {formatLiters(totalMl)}
      </span>
      <p className="text-muted-foreground text-xs">
        {goalMl ? `/ ${formatLiters(goalMl)} L` : 'L'}
      </p>
    </div>
  );
}

/** Registro de água do dia (aba Diário). */
export function WaterLogPanel({ date }: { date: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { goalMl, totalMl, logs, isLoading } = useHydrationDay(date);
  const [customMl, setCustomMl] = useState('');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['water-logs'] });
    // tarefas vinculadas à meta são concluídas/reabertas pelo backend
    void queryClient.invalidateQueries({ queryKey: ['task-instances'] });
  };

  const addMutation = useMutation({
    mutationFn: (amount_ml: number) => {
      const now = new Date();
      const isToday = date === formatLocalDate(now);
      return waterLogService.create({
        date,
        amount_ml,
        time: isToday ? now.toTimeString().slice(0, 5) : null,
      });
    },
    onSuccess: () => {
      invalidate();
      setCustomMl('');
      toast({ title: t('pages.nutritionHydration.logAdded') });
    },
    onError: (err: unknown) =>
      toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => waterLogService.delete(id),
    onSuccess: () => {
      invalidate();
      toast({ title: t('pages.nutritionHydration.logDeleted') });
    },
  });

  const pct = goalMl ? Math.min(100, Math.round((totalMl / goalMl) * 100)) : 0;
  const custom = parseInt(customMl, 10);

  return (
    <div className="mb-lg border-border bg-card p-md space-y-md rounded-lg border shadow-sm">
      <div className="gap-sm flex items-center justify-between">
        <div className="gap-xs flex items-center">
          <Droplets className="h-5 w-5 text-sky-500" />
          <span className="text-sm font-semibold">
            {t('pages.nutritionHydration.dayWater')}
          </span>
        </div>
        <span className="text-sm text-sky-500 tabular-nums">
          {formatLiters(totalMl)} L
          {goalMl ? ` / ${formatLiters(goalMl)} L (${pct}%)` : ''}
        </span>
      </div>

      {goalMl ? (
        <Progress value={pct} className="h-2" indicatorClassName="bg-sky-500" />
      ) : (
        <p className="text-muted-foreground text-xs">
          {t('pages.nutritionHydration.setGoalHint')}
        </p>
      )}

      <div className="gap-sm flex flex-wrap items-center">
        {QUICK_AMOUNTS_ML.map((ml) => (
          <Button
            key={ml}
            size="sm"
            variant="outline"
            disabled={addMutation.isPending}
            onClick={() => addMutation.mutate(ml)}
          >
            <Plus className="mr-xs h-3.5 w-3.5" />
            {ml} ml
          </Button>
        ))}
        <form
          className="gap-xs flex items-center"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom > 0) addMutation.mutate(custom);
          }}
        >
          <Input
            type="number"
            min={1}
            max={5000}
            inputMode="numeric"
            placeholder="ml"
            value={customMl}
            onChange={(e) => setCustomMl(e.target.value)}
            className="h-8 w-24"
            aria-label={t('pages.nutritionHydration.customAmount')}
          />
          <Button
            size="sm"
            type="submit"
            disabled={!(custom > 0) || addMutation.isPending}
          >
            {addMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              t('pages.nutritionHydration.add')
            )}
          </Button>
        </form>
      </div>

      {!isLoading && logs.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {t('pages.nutritionHydration.noLogs')}
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {logs.map((log) => (
            <li
              key={log.id}
              className="py-xs flex items-center justify-between text-sm"
            >
              <span className="gap-sm flex items-center">
                <span className="text-muted-foreground w-12 tabular-nums">
                  {log.time?.slice(0, 5) ?? '--:--'}
                </span>
                <span className="font-medium tabular-nums">{log.amount_ml} ml</span>
                {log.from_task && (
                  <span className="text-muted-foreground inline-flex items-center gap-0.5 text-xs">
                    <Link2 className="h-3 w-3" />
                    {t('pages.nutritionHydration.fromTask')}
                  </span>
                )}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive h-7 w-7 p-0"
                aria-label={t('common.actions.delete')}
                onClick={() => deleteMutation.mutate(log.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Aba Hidratação: meta atual + sugestão por medidas corporais e treinos. */
export function HydrationGoalCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [liters, setLiters] = useState<string | null>(null);

  const { data: goal, isLoading } = useQuery({
    queryKey: ['hydration-goal'],
    queryFn: () => hydrationGoalService.get(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
  const { data: suggestion } = useQuery({
    queryKey: ['hydration-goal', 'suggestion'],
    queryFn: () => hydrationGoalService.getSuggestion(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const saveMutation = useMutation({
    mutationFn: (ml: number) => hydrationGoalService.save(ml),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['hydration-goal'] });
      setLiters(null);
      toast({ title: t('pages.nutritionHydration.goalSaved') });
    },
    onError: (err: unknown) =>
      toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });

  const currentMl = goal?.daily_target_ml ?? null;
  const value = liters ?? (currentMl ? String(currentMl / 1000) : '');
  const ml = Math.round(parseFloat(value.replace(',', '.')) * 1000);

  if (isLoading) return null;

  return (
    <div className="space-y-md">
      <div className="border-border bg-card p-lg space-y-md rounded-lg border shadow-sm">
        <div className="gap-sm flex items-center">
          <Droplets className="h-6 w-6 text-sky-500" />
          <div>
            <p className="font-semibold">{t('pages.nutritionHydration.goalTitle')}</p>
            <p className="text-muted-foreground text-sm">
              {currentMl
                ? t('pages.nutritionHydration.currentGoal', {
                    liters: formatLiters(currentMl),
                  })
                : t('pages.nutritionHydration.noGoal')}
            </p>
          </div>
        </div>

        <form
          className="gap-sm flex items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (ml > 0) saveMutation.mutate(ml);
          }}
        >
          <div className="space-y-xs flex-1">
            <Label htmlFor="hydration-liters">
              {t('pages.nutritionHydration.litersLabel')}
            </Label>
            <Input
              id="hydration-liters"
              type="number"
              step="0.05"
              min={0.5}
              max={10}
              inputMode="decimal"
              value={value}
              onChange={(e) => setLiters(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!(ml > 0) || saveMutation.isPending}>
            {saveMutation.isPending && (
              <Loader2 className="mr-xs h-4 w-4 animate-spin" />
            )}
            {t('pages.nutritionHydration.saveGoal')}
          </Button>
        </form>
      </div>

      <div className="border-border bg-card p-lg space-y-sm rounded-lg border shadow-sm">
        <p className="gap-xs flex items-center font-semibold">
          <Sparkles className="text-primary h-4 w-4" />
          {t('pages.nutritionHydration.suggestionTitle')}
        </p>
        {suggestion?.suggested_ml ? (
          <>
            <p className="text-3xl font-bold text-sky-500 tabular-nums">
              {formatLiters(suggestion.suggested_ml)} L
            </p>
            <ul className="text-muted-foreground space-y-xs text-sm">
              <li>
                {t('pages.nutritionHydration.suggestionWeight', {
                  weight: suggestion.weight_kg,
                  perKg: suggestion.ml_per_kg,
                  base: suggestion.base_ml,
                })}
              </li>
              <li>
                {t('pages.nutritionHydration.suggestionExercise', {
                  days: suggestion.training_days_per_week,
                  minutes: suggestion.training_minutes_per_week,
                  exercise: suggestion.exercise_ml,
                })}
              </li>
            </ul>
            <Button
              variant="outline"
              onClick={() => setLiters(String(suggestion.suggested_ml! / 1000))}
            >
              {t('pages.nutritionHydration.useSuggestion')}
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            {t('pages.nutritionHydration.noWeight')}
          </p>
        )}
      </div>

      <p className="text-muted-foreground gap-xs flex items-start text-xs">
        <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t('pages.nutritionHydration.tasksHint')}
      </p>
    </div>
  );
}
