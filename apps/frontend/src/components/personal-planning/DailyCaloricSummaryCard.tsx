import { format } from 'date-fns';
import {
  Flame,
  Dumbbell,
  Utensils,
  TrendingDown,
  TrendingUp,
  Info,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { KcalBar } from './KcalBar';

interface MealEntry {
  meal_type: string;
  is_free_meal: boolean;
  calories: number;
  logged_at: string | null;
}

interface SessionEntry {
  name: string;
  duration_minutes: number | null;
  calories_burned: number | null;
}

export interface DailyCaloricSummaryData {
  date: string;
  bmr: number | null;
  tdee: number | null;
  activity_level: string;
  calories_consumed: number;
  calories_burned_exercise: number;
  net_calories: number | null;
  has_body_metrics: boolean;
  body_metrics: {
    weight_kg: number | null;
    height_cm: number | null;
    measured_at: string | null;
  };
  meals: MealEntry[];
  workout_sessions: SessionEntry[];
}

interface Props {
  data: DailyCaloricSummaryData | undefined;
  isLoading: boolean;
}

export function DailyCaloricSummaryCard({ data, isLoading }: Props) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-sm">
          <CardTitle className="gap-sm flex items-center text-sm">
            <Flame className="h-4 w-4 text-orange-500" />
            {t('pages.planningDashboard.caloricSummary.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-muted h-4 animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.has_body_metrics) {
    return (
      <Card>
        <CardHeader className="pb-sm">
          <CardTitle className="gap-sm flex items-center text-sm">
            <Flame className="h-4 w-4 text-orange-500" />
            {t('pages.planningDashboard.caloricSummary.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {t('pages.planningDashboard.caloricSummary.noMetrics')}{' '}
            <Link
              to="/planning/workout"
              className="text-primary underline-offset-4 hover:underline"
            >
              {t('pages.planningDashboard.caloricSummary.goToMetrics')}
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  const tdee = data.tdee ?? 0;
  const consumed = data.calories_consumed;
  const exerciseBurned = data.calories_burned_exercise;
  const net = data.net_calories;
  const isDeficit = net !== null && net < 0;
  const isSurplus = net !== null && net > 0;

  return (
    <Card>
      <CardHeader className="pb-sm">
        <div className="flex items-center justify-between">
          <CardTitle className="gap-sm flex items-center text-sm">
            <Flame className="h-4 w-4 text-orange-500" />
            {t('pages.planningDashboard.caloricSummary.title')}
          </CardTitle>
          <span className="text-muted-foreground text-xs">
            {format(new Date(data.date + 'T00:00:00'), 'dd/MM')}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-md">
        {/* Linha principal: consumido / TDEE */}
        <div className="gap-sm flex items-end justify-between">
          <div>
            <p className="text-3xl leading-none font-bold">
              {consumed.toLocaleString('pt-BR')}
              <span className="text-muted-foreground ml-1 text-base font-normal">
                kcal
              </span>
            </p>
            <p className="mt-xs text-muted-foreground text-xs">
              {t('pages.planningDashboard.caloricSummary.consumed')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg leading-none font-semibold">
              {tdee.toLocaleString('pt-BR')}
              <span className="text-muted-foreground ml-1 text-xs font-normal">
                kcal
              </span>
            </p>
            <p className="mt-xs gap-xs text-muted-foreground flex items-center justify-end text-xs">
              {t('pages.planningDashboard.caloricSummary.tdee')}
              <Tooltip
                content={t('pages.planningDashboard.caloricSummary.tdeeTooltip', {
                  bmr: data.bmr?.toLocaleString('pt-BR') ?? '—',
                })}
                side="left"
              >
                <Info className="h-3 w-3 cursor-help" />
              </Tooltip>
            </p>
          </div>
        </div>

        <KcalBar value={consumed} max={tdee} color="bg-orange-500" />

        {/* Linha: gasto treino + saldo */}
        <div className="gap-md pt-md grid grid-cols-2 border-t">
          <div className="gap-xs flex flex-col">
            <div className="gap-sm text-muted-foreground flex items-center">
              <Dumbbell className="h-3.5 w-3.5" />
              <span className="text-xs">
                {t('pages.planningDashboard.caloricSummary.exerciseBurned')}
              </span>
            </div>
            <span className="text-info text-xl font-bold">
              {exerciseBurned > 0 ? `-${exerciseBurned.toLocaleString('pt-BR')}` : '—'}
              {exerciseBurned > 0 && (
                <span className="text-muted-foreground ml-1 text-xs font-normal">
                  kcal
                </span>
              )}
            </span>
          </div>

          <div className="gap-xs flex flex-col">
            <div className="gap-sm text-muted-foreground flex items-center">
              {isDeficit ? (
                <TrendingDown className="text-success h-3.5 w-3.5" />
              ) : (
                <TrendingUp className="text-destructive h-3.5 w-3.5" />
              )}
              <span className="text-xs">
                {t('pages.planningDashboard.caloricSummary.balance')}
              </span>
            </div>
            {net !== null ? (
              <span
                className={cn(
                  'text-xl font-bold',
                  isDeficit
                    ? 'text-success'
                    : isSurplus
                      ? 'text-destructive'
                      : 'text-foreground'
                )}
              >
                {net > 0 ? '+' : ''}
                {net.toLocaleString('pt-BR')}
                <span className="text-muted-foreground ml-1 text-xs font-normal">
                  kcal
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground text-xl font-bold">—</span>
            )}
          </div>
        </div>

        {/* Lista de refeições */}
        {data.meals.length > 0 && (
          <div className="space-y-xs pt-sm border-t">
            <p className="gap-xs text-muted-foreground flex items-center text-xs font-medium">
              <Utensils className="h-3 w-3" />
              {t('pages.planningDashboard.caloricSummary.mealsLabel')}
            </p>
            {data.meals.map((meal, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">{meal.meal_type}</span>
                <span className="font-medium">
                  {meal.calories > 0
                    ? `${meal.calories.toLocaleString('pt-BR')} kcal`
                    : t('pages.planningDashboard.caloricSummary.freeMeal')}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Lista de treinos */}
        {data.workout_sessions.length > 0 && (
          <div className="space-y-xs pt-sm border-t">
            <p className="gap-xs text-muted-foreground flex items-center text-xs font-medium">
              <Dumbbell className="h-3 w-3" />
              {t('pages.planningDashboard.caloricSummary.sessionsLabel')}
            </p>
            {data.workout_sessions.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">{s.name}</span>
                <span className="font-medium">
                  {s.calories_burned != null
                    ? `${s.calories_burned.toLocaleString('pt-BR')} kcal`
                    : t('pages.planningDashboard.caloricSummary.noDuration')}
                  {s.duration_minutes != null && (
                    <span className="text-muted-foreground ml-1">
                      ({s.duration_minutes}min)
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
