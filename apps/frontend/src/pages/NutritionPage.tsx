/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  Flame,
  Loader2,
  Moon,
  Plus,
  Salad,
  Search,
  Sparkles,
  Sun,
  Sunrise,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { FoodForm } from '@/components/nutrition/FoodForm';
import { MealLogForm } from '@/components/nutrition/MealLogForm';
import { MealTypeForm } from '@/components/nutrition/MealTypeForm';
import { MenuOptionForm } from '@/components/nutrition/MenuOptionForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api-client';
import { membersService } from '@/services/members-service';
import {
  foodService,
  mealLogService,
  mealTypeService,
  menuOptionIngredientService,
  menuOptionService,
} from '@/services/nutrition-service';
import type {
  Food,
  FoodFormData,
  MealLog,
  MealLogFormData,
  MealType,
  MealTypeFormData,
  MenuOption,
  MenuOptionIngredient,
} from '@/types/nutrition';
import { getErrorMessage } from '@/utils/error-utils';

type DialogMode =
  | { type: 'new-food' }
  | { type: 'edit-food'; food: Food }
  | { type: 'new-meal-type' }
  | { type: 'edit-meal-type'; mealType: MealType }
  | { type: 'new-option'; mealTypeId: number }
  | { type: 'edit-option'; option: MenuOption }
  | { type: 'new-log'; prefillMealType?: number }
  | { type: 'edit-log'; log: MealLog }
  | { type: 'ai-generate-menu' }
  | null;

interface AIMenuFormValues {
  calories: number;
  preferences: string;
  restrictions: string;
  meals_per_day: number;
}

interface MealPeriodTheme {
  cardBg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  dotDone: string;
  dotLate: string;
  icon: ReactNode;
  label: string;
}

function getMealPeriodTheme(time?: string | null): MealPeriodTheme {
  if (!time)
    return {
      cardBg: 'bg-card',
      border: 'border-border',
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      dotDone: 'border-success bg-success',
      dotLate: 'border-warning bg-warning/30',
      icon: <UtensilsCrossed className="text-muted-foreground h-5 w-5" />,
      label: '',
    };
  const h = parseInt(time.slice(0, 2));
  if (h >= 4 && h < 9)
    return {
      cardBg: 'bg-amber-500/5',
      border: 'border-amber-500/30',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-500',
      dotDone: 'border-success bg-success',
      dotLate: 'border-warning bg-warning/30',
      icon: <Sunrise className="h-5 w-5 text-amber-500" />,
      label: 'Manhã',
    };
  if (h >= 9 && h < 12)
    return {
      cardBg: 'bg-yellow-500/5',
      border: 'border-yellow-500/25',
      iconBg: 'bg-yellow-500/15',
      iconColor: 'text-yellow-600',
      dotDone: 'border-success bg-success',
      dotLate: 'border-warning bg-warning/30',
      icon: <Sun className="h-5 w-5 text-yellow-500" />,
      label: 'Manhã',
    };
  if (h >= 12 && h < 15)
    return {
      cardBg: 'bg-orange-500/5',
      border: 'border-orange-500/30',
      iconBg: 'bg-orange-500/15',
      iconColor: 'text-orange-500',
      dotDone: 'border-success bg-success',
      dotLate: 'border-warning bg-warning/30',
      icon: <Sun className="h-5 w-5 text-orange-500" />,
      label: 'Almoço',
    };
  if (h >= 15 && h < 19)
    return {
      cardBg: 'bg-amber-600/5',
      border: 'border-amber-600/25',
      iconBg: 'bg-amber-600/15',
      iconColor: 'text-amber-600',
      dotDone: 'border-success bg-success',
      dotLate: 'border-warning bg-warning/30',
      icon: <Sun className="h-5 w-5 text-amber-600" />,
      label: 'Tarde',
    };
  return {
    cardBg: 'bg-violet-500/5',
    border: 'border-violet-500/30',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-500',
    dotDone: 'border-success bg-success',
    dotLate: 'border-warning bg-warning/30',
    icon: <Moon className="h-5 w-5 text-violet-500" />,
    label: 'Noite',
  };
}

export default function NutritionPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [aiMenuForm, setAiMenuForm] = useState<AIMenuFormValues>({
    calories: 2000,
    preferences: '',
    restrictions: '',
    meals_per_day: 3,
  });
  const [expandedMealTypes, setExpandedMealTypes] = useState<Set<number>>(new Set());
  const [foodSearch, setFoodSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const { data: member } = useQuery({
    queryKey: ['current-member'],
    queryFn: () => membersService.getCurrentUserMember(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
  const ownerId = member?.id ?? 0;

  const { data: foodsData, isLoading: foodsLoading } = useQuery({
    queryKey: ['foods'],
    queryFn: () => foodService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: mealTypesData, isLoading: mealTypesLoading } = useQuery({
    queryKey: ['meal-types'],
    queryFn: () => mealTypeService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['meal-logs'],
    queryFn: () => mealLogService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const foods = foodsData ?? [];
  const mealTypes = mealTypesData ?? [];
  const logs = logsData ?? [];

  const selectedLogs = logs.filter((l) => l.date === selectedDate);
  const activeMealTypes = mealTypes.filter((mt) => mt.is_active);
  const adherencePct =
    activeMealTypes.length > 0
      ? Math.round((selectedLogs.length / activeMealTypes.length) * 100)
      : 0;

  const navigateDay = (delta: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const filteredFoods = foods.filter((f) =>
    f.name.toLowerCase().includes(foodSearch.toLowerCase())
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  const invalidateFoods = () => queryClient.invalidateQueries({ queryKey: ['foods'] });
  const invalidateMealTypes = () =>
    queryClient.invalidateQueries({ queryKey: ['meal-types'] });
  const invalidateLogs = () =>
    queryClient.invalidateQueries({ queryKey: ['meal-logs'] });

  const aiGenerateMenuMutation = useMutation({
    mutationFn: (data: AIMenuFormValues) =>
      apiClient.post<{ meal_types_created: number; options_created: number }>(
        '/api/v1/personal-planning/ai-menu-plan/',
        data
      ),
    onSuccess: (result) => {
      void invalidateMealTypes();
      toast({
        title: 'Cardápio gerado com sucesso!',
        description: `${result.meal_types_created} refeições com ${result.options_created} opções criadas.`,
      });
      setAiMenuForm({
        calories: 2000,
        preferences: '',
        restrictions: '',
        meals_per_day: 3,
      });
      setDialog(null);
    },
    onError: () => {
      toast({
        title: 'Erro ao gerar cardápio',
        description: 'Não foi possível gerar o cardápio. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const createFoodMutation = useMutation({
    mutationFn: (data: FoodFormData) => foodService.create(data),
    onSuccess: () => {
      void invalidateFoods();
      toast({
        title: t('pages.nutritionFoods.foodCreated'),
        description: t('pages.nutritionFoods.foodCreatedDesc'),
      });
      setDialog(null);
    },
  });

  const updateFoodMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FoodFormData }) =>
      foodService.update(id, data),
    onSuccess: () => {
      void invalidateFoods();
      toast({
        title: t('pages.nutritionFoods.foodUpdated'),
        description: t('pages.nutritionFoods.foodUpdatedDesc'),
      });
      setDialog(null);
    },
  });

  const deleteFoodMutation = useMutation({
    mutationFn: (id: number) => foodService.delete(id),
    onSuccess: () => {
      void invalidateFoods();
      toast({
        title: t('pages.nutritionFoods.foodDeleted'),
        description: t('pages.nutritionFoods.foodDeletedDesc'),
      });
    },
  });

  const createMealTypeMutation = useMutation({
    mutationFn: (data: MealTypeFormData) => mealTypeService.create(data),
    onSuccess: () => {
      void invalidateMealTypes();
      toast({
        title: t('pages.nutritionMealTypes.mealTypeCreated'),
        description: t('pages.nutritionMealTypes.mealTypeCreatedDesc'),
      });
      setDialog(null);
    },
  });

  const updateMealTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: MealTypeFormData }) =>
      mealTypeService.update(id, data),
    onSuccess: () => {
      void invalidateMealTypes();
      toast({
        title: t('pages.nutritionMealTypes.mealTypeUpdated'),
        description: t('pages.nutritionMealTypes.mealTypeUpdatedDesc'),
      });
      setDialog(null);
    },
  });

  const deleteMealTypeMutation = useMutation({
    mutationFn: (id: number) => mealTypeService.delete(id),
    onSuccess: () => {
      void invalidateMealTypes();
      toast({
        title: t('pages.nutritionMealTypes.mealTypeDeleted'),
        description: t('pages.nutritionMealTypes.mealTypeDeletedDesc'),
      });
    },
  });

  const createOptionMutation = useMutation({
    mutationFn: async ({
      optionData,
      ingredients,
    }: {
      optionData: { meal_type: number; name: string; order: number; owner: number };
      ingredients: {
        food: string;
        quantity: string;
        unit: string;
        is_optional: boolean;
        notes: string;
        order: number;
        alternative_group: string;
      }[];
    }) => {
      const option = await menuOptionService.create(optionData);
      await Promise.all(
        ingredients.map((ing) =>
          menuOptionIngredientService.create({
            menu_option: option.id,
            food: Number(ing.food),
            quantity: ing.quantity || undefined,
            unit: ing.unit,
            is_optional: ing.is_optional,
            notes: ing.notes || undefined,
            order: ing.order,
            alternative_group: ing.alternative_group
              ? Number(ing.alternative_group)
              : undefined,
            owner: ownerId,
          })
        )
      );
      return option;
    },
    onSuccess: () => {
      void invalidateMealTypes();
      toast({
        title: t('pages.nutritionMealTypes.optionCreated'),
        description: t('pages.nutritionMealTypes.optionCreatedDesc'),
      });
      setDialog(null);
    },
  });

  const updateOptionMutation = useMutation({
    mutationFn: async ({
      id,
      optionData,
      ingredients,
    }: {
      id: number;
      optionData: { meal_type: number; name: string; order: number; owner: number };
      ingredients: {
        id?: number;
        food: string;
        quantity: string;
        unit: string;
        is_optional: boolean;
        notes: string;
        order: number;
        alternative_group: string;
      }[];
    }) => {
      await menuOptionService.update(id, optionData);
      const existing = await menuOptionIngredientService.getByMenuOption(id);
      const existingIds = new Set(existing.map((e) => e.id));
      const incomingIds = new Set(ingredients.filter((i) => i.id).map((i) => i.id!));
      const toDelete = [...existingIds].filter((eid) => !incomingIds.has(eid));
      await Promise.all(toDelete.map((eid) => menuOptionIngredientService.delete(eid)));
      await Promise.all(
        ingredients.map((ing) =>
          ing.id
            ? menuOptionIngredientService.update(ing.id, {
                menu_option: id,
                food: Number(ing.food),
                quantity: ing.quantity || undefined,
                unit: ing.unit,
                is_optional: ing.is_optional,
                notes: ing.notes || undefined,
                order: ing.order,
                alternative_group: ing.alternative_group
                  ? Number(ing.alternative_group)
                  : undefined,
                owner: ownerId,
              })
            : menuOptionIngredientService.create({
                menu_option: id,
                food: Number(ing.food),
                quantity: ing.quantity || undefined,
                unit: ing.unit,
                is_optional: ing.is_optional,
                notes: ing.notes || undefined,
                order: ing.order,
                alternative_group: ing.alternative_group
                  ? Number(ing.alternative_group)
                  : undefined,
                owner: ownerId,
              })
        )
      );
    },
    onSuccess: () => {
      void invalidateMealTypes();
      toast({
        title: t('pages.nutritionMealTypes.optionUpdated'),
        description: t('pages.nutritionMealTypes.optionUpdatedDesc'),
      });
      setDialog(null);
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: (id: number) => menuOptionService.delete(id),
    onSuccess: () => {
      void invalidateMealTypes();
      toast({
        title: t('pages.nutritionMealTypes.optionDeleted'),
        description: t('pages.nutritionMealTypes.optionDeletedDesc'),
      });
    },
  });

  const createLogMutation = useMutation({
    mutationFn: (data: MealLogFormData) => mealLogService.create(data),
    onSuccess: () => {
      void invalidateLogs();
      toast({
        title: t('pages.nutritionLog.logCreated'),
        description: t('pages.nutritionLog.logCreatedDesc'),
      });
      setDialog(null);
    },
    onError: (err: unknown) => {
      toast({
        title: t('pages.nutritionLog.saveError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    },
  });

  const updateLogMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: MealLogFormData }) =>
      mealLogService.update(id, data),
    onSuccess: () => {
      void invalidateLogs();
      toast({
        title: t('pages.nutritionLog.logUpdated'),
        description: t('pages.nutritionLog.logUpdatedDesc'),
      });
      setDialog(null);
    },
  });

  const deleteLogMutation = useMutation({
    mutationFn: (id: number) => mealLogService.delete(id),
    onSuccess: () => {
      void invalidateLogs();
      toast({
        title: t('pages.nutritionLog.logDeleted'),
        description: t('pages.nutritionLog.logDeletedDesc'),
      });
    },
    onError: (err: unknown) => {
      toast({
        title: t('pages.nutritionLog.deleteError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleMealType = (id: number) => {
    setExpandedMealTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ── Dialog title/desc ──────────────────────────────────────────────────────

  const dialogTitle = () => {
    if (!dialog) return '';
    switch (dialog.type) {
      case 'new-food':
        return t('pages.nutritionFoods.newFoodTitle');
      case 'edit-food':
        return t('pages.nutritionFoods.editFoodTitle');
      case 'new-meal-type':
        return t('pages.nutritionMealTypes.newMealTypeTitle');
      case 'edit-meal-type':
        return t('pages.nutritionMealTypes.editMealTypeTitle');
      case 'new-option':
        return t('pages.nutritionMealTypes.newOptionTitle');
      case 'edit-option':
        return t('pages.nutritionMealTypes.editOptionTitle');
      case 'new-log':
        return t('pages.nutritionLog.newLogTitle');
      case 'edit-log':
        return t('pages.nutritionLog.editLogTitle');
      case 'ai-generate-menu':
        return 'Gerar Cardápio com IA';
    }
  };

  const dialogDesc = () => {
    if (!dialog) return '';
    switch (dialog.type) {
      case 'new-food':
        return t('pages.nutritionFoods.newFoodDesc');
      case 'edit-food':
        return t('pages.nutritionFoods.editFoodDesc');
      case 'new-meal-type':
        return t('pages.nutritionMealTypes.newMealTypeDesc');
      case 'edit-meal-type':
        return t('pages.nutritionMealTypes.editMealTypeDesc');
      case 'new-option':
        return t('pages.nutritionMealTypes.newOptionDesc');
      case 'edit-option':
        return t('pages.nutritionMealTypes.editOptionDesc');
      case 'new-log':
        return t('pages.nutritionLog.newLogDesc');
      case 'edit-log':
        return t('pages.nutritionLog.editLogDesc');
      case 'ai-generate-menu':
        return 'Informe suas preferências e a IA criará tipos de refeição com opções variadas.';
    }
  };

  const selectedDateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString(
    i18n.language === 'pt-BR' ? 'pt-BR' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long' }
  );

  // SVG circular progress constants
  const RADIUS = 30;
  const CIRC = 2 * Math.PI * RADIUS;
  const dashOffset = CIRC - (adherencePct / 100) * CIRC;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('pages.nutritionFoods.title')}
          icon={<UtensilsCrossed className="text-category-nutrition h-6 w-6" />}
        />

        <Tabs defaultValue="today" className="flex flex-1 flex-col">
          <TabsList className="mb-lg w-full">
            <TabsTrigger value="today" className="gap-xs flex-1">
              <Sun className="h-4 w-4" />
              {t('pages.nutritionHub.todayMeals')}
            </TabsTrigger>
            <TabsTrigger value="log" className="gap-xs flex-1">
              <CalendarDays className="h-4 w-4" />
              {t('pages.nutritionFoods.tabLog')}
            </TabsTrigger>
            <TabsTrigger value="meal-types" className="gap-xs flex-1">
              <UtensilsCrossed className="h-4 w-4" />
              {t('pages.nutritionFoods.tabMealTypes')}
            </TabsTrigger>
            <TabsTrigger value="foods" className="gap-xs flex-1">
              <Salad className="h-4 w-4" />
              {t('pages.nutritionFoods.tabFoods')}
            </TabsTrigger>
          </TabsList>

          {/* ── Hoje ─────────────────────────────────────────────────────── */}
          <TabsContent value="today" className="mt-0 flex-1">
            <div className="space-y-md">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm font-medium">
                  {t('pages.nutritionHub.subtitle')}
                </p>
                <Button onClick={() => setDialog({ type: 'new-log' })}>
                  <Plus className="mr-sm h-4 w-4" />
                  {t('pages.nutritionHub.addMeal')}
                </Button>
              </div>
              {(() => {
                const today = new Date().toISOString().slice(0, 10);
                const todayLogs = logs.filter((l) => l.date === today);
                if (logsLoading) return <LoadingState />;
                if (todayLogs.length === 0)
                  return (
                    <EmptyState
                      title={t('pages.nutritionHub.noMealsToday')}
                      icon={<UtensilsCrossed className="h-8 w-8" />}
                      action={{
                        label: t('pages.nutritionHub.addMeal'),
                        icon: <Plus className="mr-xs h-4 w-4" />,
                        onClick: () => setDialog({ type: 'new-log' }),
                      }}
                    />
                  );
                return (
                  <div className="space-y-sm">
                    {todayLogs.map((log) => {
                      const linkedOption = log.menu_option
                        ? mealTypes
                            .flatMap((mt) => mt.options)
                            .find((o) => o.id === log.menu_option)
                        : null;
                      const totalCal = linkedOption
                        ? linkedOption.ingredients.reduce((acc, ing) => {
                            const c = calcCalories(ing);
                            return c != null ? acc + c : acc;
                          }, 0)
                        : null;
                      const hasCalData =
                        linkedOption?.ingredients.some(
                          (ing) => calcCalories(ing) != null
                        ) ?? false;
                      return (
                        <div
                          key={log.id}
                          className="border-border p-sm flex items-center justify-between rounded-md border"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {log.meal_type_name ?? log.meal_type}
                            </p>
                            <div className="gap-xs mt-0.5 flex flex-wrap items-center">
                              {log.menu_option_name && (
                                <p className="text-muted-foreground text-xs">
                                  {log.menu_option_name}
                                </p>
                              )}
                              {hasCalData && totalCal != null && totalCal > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-xs text-orange-500">
                                  <Flame className="h-3 w-3" />
                                  {totalCal} kcal
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="gap-sm flex items-center">
                            <span className="text-muted-foreground text-xs">
                              {log.time ?? ''}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive h-7 w-7 p-0"
                              onClick={() => deleteLogMutation.mutate(log.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </TabsContent>

          {/* ── Diário ───────────────────────────────────────────────────── */}
          <TabsContent value="log" className="mt-0 flex-1">
            {/* Navegação de data */}
            <div className="mb-md gap-sm flex items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateDay(-1)}
                title={t('pages.nutritionLog.prevDay')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <DatePicker
                  value={selectedDate}
                  onChange={(v) =>
                    setSelectedDate(
                      v
                        ? v.toISOString().slice(0, 10)
                        : new Date().toISOString().slice(0, 10)
                    )
                  }
                  placeholder={t('pages.nutritionLog.selectDate')}
                  maxDate={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateDay(1)}
                disabled={selectedDate >= new Date().toISOString().slice(0, 10)}
                title={t('pages.nutritionLog.nextDay')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Header card com aderência */}
            <div className="mb-lg border-border bg-card overflow-hidden rounded-lg border shadow-sm">
              <div className="gap-md px-lg py-md flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-sm font-medium capitalize">
                    {selectedDateLabel}
                  </p>
                  <div className="mt-xs gap-xs flex items-baseline">
                    <span className="text-category-nutrition text-4xl font-bold tabular-nums">
                      {selectedLogs.length}
                    </span>
                    <span className="text-muted-foreground text-xl">
                      / {activeMealTypes.length}
                    </span>
                  </div>
                  <p className="mt-xs text-muted-foreground text-sm">
                    {t('pages.nutritionLog.mealsLogged', {
                      logged: selectedLogs.length,
                      total: activeMealTypes.length,
                    })}
                  </p>
                </div>

                {/* Circular progress */}
                {activeMealTypes.length > 0 && (
                  <div className="relative shrink-0">
                    <svg
                      width="80"
                      height="80"
                      viewBox="0 0 80 80"
                      className="-rotate-90"
                    >
                      <circle
                        cx="40"
                        cy="40"
                        r={RADIUS}
                        fill="none"
                        strokeWidth="7"
                        className="stroke-muted"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r={RADIUS}
                        fill="none"
                        strokeWidth="7"
                        strokeLinecap="round"
                        className="stroke-category-nutrition transition-all duration-500"
                        strokeDasharray={CIRC}
                        strokeDashoffset={dashOffset}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-category-nutrition text-sm font-bold">
                        {adherencePct}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-border px-lg py-sm border-t">
                <Button
                  size="sm"
                  onClick={() => setDialog({ type: 'new-log' })}
                  className="w-full sm:w-auto"
                >
                  <Plus className="mr-xs h-4 w-4" />
                  {t('pages.nutritionLog.newLogBtn')}
                </Button>
              </div>
            </div>

            {logsLoading ? (
              <LoadingState />
            ) : (
              <MealTimeline
                mealTypes={activeMealTypes}
                logs={selectedLogs}
                onEdit={(log) => setDialog({ type: 'edit-log', log })}
                onDelete={async (log) => {
                  const ok = await showConfirm({
                    title: t('pages.nutritionLog.deleteLogTitle'),
                    description: t('pages.nutritionLog.deleteLogDesc'),
                  });
                  if (ok) deleteLogMutation.mutate(log.id);
                }}
                onRegister={(mealTypeId) =>
                  setDialog({ type: 'new-log', prefillMealType: mealTypeId })
                }
                t={t}
              />
            )}
          </TabsContent>

          {/* ── Plano Alimentar ──────────────────────────────────────────── */}
          <TabsContent value="meal-types" className="mt-0 flex-1">
            <div className="mb-md gap-sm flex justify-end">
              <Button
                variant="outline"
                onClick={() => setDialog({ type: 'ai-generate-menu' })}
              >
                <Sparkles className="mr-sm text-primary h-4 w-4" />
                Gerar com IA
              </Button>
              <Button onClick={() => setDialog({ type: 'new-meal-type' })}>
                <Plus className="mr-sm h-4 w-4" />
                {t('pages.nutritionMealTypes.newMealTypeBtn')}
              </Button>
            </div>

            {mealTypesLoading ? (
              <LoadingState />
            ) : mealTypes.length === 0 ? (
              <EmptyState
                title={t('pages.nutritionMealTypes.emptyMealTypes')}
                description={t('pages.nutritionMealTypes.emptyMealTypesDesc')}
                icon={<UtensilsCrossed className="h-8 w-8" />}
                action={{
                  label: t('pages.nutritionMealTypes.newMealTypeBtn'),
                  icon: <Plus className="h-4 w-4" />,
                  onClick: () => setDialog({ type: 'new-meal-type' }),
                }}
              />
            ) : (
              <div className="space-y-sm">
                {mealTypes.map((mt) => (
                  <MealTypeCard
                    key={mt.id}
                    mealType={mt}
                    expanded={expandedMealTypes.has(mt.id)}
                    onToggle={() => toggleMealType(mt.id)}
                    onEdit={() => setDialog({ type: 'edit-meal-type', mealType: mt })}
                    onDelete={async () => {
                      const ok = await showConfirm({
                        title: t('pages.nutritionMealTypes.deleteMealTypeTitle'),
                        description: t('pages.nutritionMealTypes.deleteMealTypeDesc'),
                      });
                      if (ok) deleteMealTypeMutation.mutate(mt.id);
                    }}
                    onNewOption={() =>
                      setDialog({ type: 'new-option', mealTypeId: mt.id })
                    }
                    onEditOption={(opt) =>
                      setDialog({ type: 'edit-option', option: opt })
                    }
                    onDeleteOption={async (opt) => {
                      const ok = await showConfirm({
                        title: t('pages.nutritionMealTypes.deleteOptionTitle'),
                        description: t('pages.nutritionMealTypes.deleteOptionDesc'),
                      });
                      if (ok) deleteOptionMutation.mutate(opt.id);
                    }}
                    t={t}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Alimentos ────────────────────────────────────────────────── */}
          <TabsContent value="foods" className="mt-0 flex-1">
            <div className="mb-md gap-sm flex items-center">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('pages.nutritionFoods.searchPlaceholder')}
                  value={foodSearch}
                  onChange={(e) => setFoodSearch(e.target.value)}
                  className="border-input bg-background py-sm focus:ring-ring w-full rounded-lg border pr-3 pl-9 text-sm outline-none focus:ring-2"
                />
              </div>
              <Button onClick={() => setDialog({ type: 'new-food' })}>
                <Plus className="mr-sm h-4 w-4" />
                {t('pages.nutritionFoods.newFoodBtn')}
              </Button>
            </div>

            {foodsLoading ? (
              <LoadingState />
            ) : filteredFoods.length === 0 ? (
              <EmptyState
                title={t('pages.nutritionFoods.emptyFoods')}
                description={t('pages.nutritionFoods.emptyFoodsDesc')}
                icon={<Salad className="h-8 w-8" />}
                action={{
                  label: t('pages.nutritionFoods.newFoodBtn'),
                  icon: <Plus className="h-4 w-4" />,
                  onClick: () => setDialog({ type: 'new-food' }),
                }}
              />
            ) : (
              <div className="gap-sm grid sm:grid-cols-2 lg:grid-cols-3">
                {filteredFoods.map((food) => (
                  <FoodCard
                    key={food.id}
                    food={food}
                    onEdit={() => setDialog({ type: 'edit-food', food })}
                    onDelete={async () => {
                      const ok = await showConfirm({
                        title: t('pages.nutritionFoods.deleteFoodTitle'),
                        description: t('pages.nutritionFoods.deleteFoodDesc'),
                      });
                      if (ok) deleteFoodMutation.mutate(food.id);
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Dialog ────────────────────────────────────────────────────── */}
        <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{dialogTitle()}</DialogTitle>
              <DialogDescription>{dialogDesc()}</DialogDescription>
            </DialogHeader>

            {(dialog?.type === 'new-food' || dialog?.type === 'edit-food') && (
              <FoodForm
                food={dialog.type === 'edit-food' ? dialog.food : undefined}
                ownerId={ownerId}
                onSubmit={async (data) => {
                  if (dialog.type === 'edit-food') {
                    await updateFoodMutation.mutateAsync({ id: dialog.food.id, data });
                  } else {
                    await createFoodMutation.mutateAsync(data);
                  }
                }}
                onCancel={() => setDialog(null)}
                isLoading={createFoodMutation.isPending || updateFoodMutation.isPending}
              />
            )}

            {(dialog?.type === 'new-meal-type' ||
              dialog?.type === 'edit-meal-type') && (
              <MealTypeForm
                mealType={
                  dialog.type === 'edit-meal-type' ? dialog.mealType : undefined
                }
                ownerId={ownerId}
                onSubmit={async (data) => {
                  if (dialog.type === 'edit-meal-type') {
                    await updateMealTypeMutation.mutateAsync({
                      id: dialog.mealType.id,
                      data,
                    });
                  } else {
                    await createMealTypeMutation.mutateAsync(data);
                  }
                }}
                onCancel={() => setDialog(null)}
                isLoading={
                  createMealTypeMutation.isPending || updateMealTypeMutation.isPending
                }
              />
            )}

            {(dialog?.type === 'new-option' || dialog?.type === 'edit-option') && (
              <MenuOptionForm
                option={dialog.type === 'edit-option' ? dialog.option : undefined}
                mealTypeId={
                  dialog.type === 'new-option'
                    ? dialog.mealTypeId
                    : dialog.option.meal_type
                }
                ownerId={ownerId}
                foods={foods}
                onSubmit={async (optionData, ingredients) => {
                  if (dialog.type === 'edit-option') {
                    await updateOptionMutation.mutateAsync({
                      id: dialog.option.id,
                      optionData,
                      ingredients,
                    });
                  } else {
                    await createOptionMutation.mutateAsync({ optionData, ingredients });
                  }
                }}
                onCancel={() => setDialog(null)}
                isLoading={
                  createOptionMutation.isPending || updateOptionMutation.isPending
                }
              />
            )}

            {(dialog?.type === 'new-log' || dialog?.type === 'edit-log') && (
              <MealLogForm
                log={dialog.type === 'edit-log' ? dialog.log : undefined}
                prefillMealTypeId={
                  dialog.type === 'new-log' ? dialog.prefillMealType : undefined
                }
                prefillDate={dialog.type === 'new-log' ? selectedDate : undefined}
                mealTypes={mealTypes}
                ownerId={ownerId}
                onSubmit={async (data) => {
                  if (dialog.type === 'edit-log') {
                    await updateLogMutation.mutateAsync({ id: dialog.log.id, data });
                  } else {
                    await createLogMutation.mutateAsync(data);
                  }
                }}
                onCancel={() => setDialog(null)}
                isLoading={createLogMutation.isPending || updateLogMutation.isPending}
              />
            )}

            {dialog?.type === 'ai-generate-menu' && (
              <div className="space-y-md">
                <div className="space-y-sm">
                  <Label htmlFor="ai-calories">Objetivo calórico diário (kcal)</Label>
                  <Input
                    id="ai-calories"
                    type="number"
                    min={800}
                    max={5000}
                    step={50}
                    value={aiMenuForm.calories}
                    onChange={(e) =>
                      setAiMenuForm((f) => ({ ...f, calories: Number(e.target.value) }))
                    }
                  />
                </div>

                <div className="space-y-sm">
                  <Label htmlFor="ai-preferences">Preferências alimentares</Label>
                  <Input
                    id="ai-preferences"
                    placeholder="Ex: vegetariano, low carb, mediterrâneo…"
                    value={aiMenuForm.preferences}
                    onChange={(e) =>
                      setAiMenuForm((f) => ({ ...f, preferences: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-sm">
                  <Label htmlFor="ai-restrictions">Restrições alimentares</Label>
                  <Input
                    id="ai-restrictions"
                    placeholder="Ex: sem glúten, sem lactose, alergia a amendoim…"
                    value={aiMenuForm.restrictions}
                    onChange={(e) =>
                      setAiMenuForm((f) => ({ ...f, restrictions: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-sm">
                  <Label>Refeições por dia: {aiMenuForm.meals_per_day}</Label>
                  <div className="gap-xs flex">
                    {[2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setAiMenuForm((f) => ({ ...f, meals_per_day: n }))
                        }
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-md border text-xs font-bold transition-colors',
                          aiMenuForm.meals_per_day === n
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-input bg-background text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="gap-sm pt-sm flex">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDialog(null)}
                    disabled={aiGenerateMenuMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={aiGenerateMenuMutation.isPending}
                    onClick={() => aiGenerateMenuMutation.mutate(aiMenuForm)}
                  >
                    {aiGenerateMenuMutation.isPending ? (
                      <>
                        <Loader2 className="mr-sm h-4 w-4 animate-spin" />
                        Gerando…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-sm h-4 w-4" />
                        Gerar Cardápio
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AnimatedPage>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface MealTypeCardProps {
  mealType: MealType;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNewOption: () => void;
  onEditOption: (opt: MenuOption) => void;
  onDeleteOption: (opt: MenuOption) => void;
  t: (key: string) => string;
}

function MealTypeCard({
  mealType,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onNewOption,
  onEditOption,
  onDeleteOption,
  t,
}: MealTypeCardProps) {
  const theme = getMealPeriodTheme(mealType.suggested_time);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border',
        mealType.is_active ? theme.border : 'border-border'
      )}
    >
      {/* Card header */}
      <div
        className={cn(
          'gap-sm px-md py-sm flex items-center',
          mealType.is_active ? theme.cardBg : 'bg-card'
        )}
      >
        <button
          type="button"
          className="gap-sm flex min-w-0 flex-1 items-center text-left"
          onClick={onToggle}
        >
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              mealType.is_active ? theme.iconBg : 'bg-muted'
            )}
          >
            {theme.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="leading-snug font-semibold">{mealType.name}</p>
            <div className="gap-sm mt-0.5 flex items-center">
              {mealType.suggested_time && (
                <span
                  className={cn(
                    'gap-xs flex items-center text-xs font-medium',
                    mealType.is_active ? theme.iconColor : 'text-muted-foreground'
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {mealType.suggested_time.slice(0, 5)}
                </span>
              )}
              <span className="text-muted-foreground text-xs">
                {mealType.options.length}{' '}
                {mealType.options.length === 1
                  ? t('pages.nutritionMealTypes.optionSingular')
                  : t('pages.nutritionMealTypes.optionPlural')}
              </span>
            </div>
          </div>
          {expanded ? (
            <ChevronDown className="text-muted-foreground ml-auto h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground ml-auto h-4 w-4 shrink-0" />
          )}
        </button>
        <div className="ml-sm gap-xs flex shrink-0 items-center">
          <Badge variant={mealType.is_active ? 'success' : 'secondary'}>
            {mealType.is_active
              ? t('pages.nutritionMealTypes.active')
              : t('pages.nutritionMealTypes.inactive')}
          </Badge>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="meal-type-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-border bg-card p-md border-t">
              <div className="mb-sm flex justify-end">
                <Button variant="outline" size="sm" onClick={onNewOption}>
                  <Plus className="mr-xs h-3 w-3" />
                  {t('pages.nutritionMealTypes.newOptionBtn')}
                </Button>
              </div>
              {mealType.options.length === 0 ? (
                <p className="py-sm text-muted-foreground text-center text-xs">
                  {t('pages.nutritionMealTypes.noIngredients')}
                </p>
              ) : (
                <div className="space-y-sm">
                  {mealType.options.map((opt) => (
                    <div
                      key={opt.id}
                      className="border-border bg-muted/20 overflow-hidden rounded-lg border"
                    >
                      {/* Option header */}
                      <div className="border-border/60 bg-card px-sm py-xs flex items-center justify-between border-b">
                        <div className="gap-xs flex items-center">
                          <div className="bg-category-nutrition/10 flex h-6 w-6 items-center justify-center rounded-lg">
                            <BookOpen className="text-category-nutrition h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm font-semibold">{opt.name}</span>
                          {(() => {
                            const total = opt.ingredients.reduce((acc, ing) => {
                              const c = calcCalories(ing);
                              return c != null ? acc + c : acc;
                            }, 0);
                            const hasData = opt.ingredients.some(
                              (ing) => calcCalories(ing) != null
                            );
                            return hasData && total > 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-xs text-orange-500">
                                <Flame className="h-3 w-3" />
                                {total} kcal
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <div className="gap-xs flex">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onEditOption(opt)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive h-7 w-7"
                            onClick={() => onDeleteOption(opt)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {/* Ingredients */}
                      {opt.ingredients.length > 0 ? (
                        <IngredientList ingredients={opt.ingredients} />
                      ) : (
                        <p className="px-sm py-xs text-muted-foreground text-xs">
                          {t('pages.nutritionMealTypes.noIngredients')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface MealTimelineProps {
  mealTypes: MealType[];
  logs: MealLog[];
  onEdit: (log: MealLog) => void;
  onDelete: (log: MealLog) => void;
  onRegister: (mealTypeId: number) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function MealTimeline({
  mealTypes,
  logs,
  onEdit,
  onDelete,
  onRegister,
  t,
}: MealTimelineProps) {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (mealTypes.length === 0) {
    return (
      <EmptyState
        title={t('pages.nutritionLog.emptyLog')}
        description={t('pages.nutritionLog.emptyLogDesc')}
        icon={<UtensilsCrossed className="h-8 w-8" />}
      />
    );
  }

  return (
    <div className="space-y-xs">
      {mealTypes.map((mt, idx) => {
        const log = logs.find((l) => l.meal_type === mt.id);
        const isLate =
          !log && mt.suggested_time && mt.suggested_time.slice(0, 5) < currentTime;
        const theme = getMealPeriodTheme(mt.suggested_time);

        return (
          <div key={mt.id} className="gap-sm flex">
            {/* Timeline spine */}
            <div className="pt-md flex shrink-0 flex-col items-center">
              <div
                className={cn(
                  'h-3 w-3 rounded-full border-2 transition-colors',
                  log
                    ? log.is_free_meal
                      ? 'border-primary bg-primary'
                      : 'border-success bg-success'
                    : isLate
                      ? 'border-warning bg-warning/30'
                      : 'border-border bg-background'
                )}
              />
              {idx < mealTypes.length - 1 && (
                <div className="mt-xs bg-border w-0.5 flex-1" />
              )}
            </div>

            {/* Meal card */}
            <div
              className={cn(
                'mb-xs flex-1 overflow-hidden rounded-lg border transition-colors',
                log
                  ? 'border-success/30 bg-success/5'
                  : isLate
                    ? 'border-warning/30 bg-warning/5'
                    : theme.border + ' ' + theme.cardBg
              )}
            >
              {/* Period label strip */}
              {theme.label && !log && !isLate && (
                <div
                  className={cn(
                    'px-sm border-b py-0.5 text-[10px] font-semibold tracking-wider uppercase',
                    theme.border,
                    theme.iconColor
                  )}
                >
                  {theme.label}
                </div>
              )}

              <div className="gap-sm p-sm flex items-start justify-between">
                <div className="gap-sm flex min-w-0 items-start">
                  <div
                    className={cn(
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      log ? 'bg-success/15' : isLate ? 'bg-warning/15' : theme.iconBg
                    )}
                  >
                    {log ? (
                      <CheckCircle2 className="text-success h-5 w-5" />
                    ) : isLate ? (
                      <AlertCircle className="text-warning h-5 w-5" />
                    ) : (
                      theme.icon
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="leading-snug font-semibold">{mt.name}</p>
                    <div className="gap-xs mt-0.5 flex flex-wrap items-center">
                      {mt.suggested_time && (
                        <span className="gap-xs text-muted-foreground flex items-center text-xs">
                          <Clock className="h-3 w-3" />
                          {t('pages.nutritionLog.suggestedTime', {
                            time: mt.suggested_time.slice(0, 5),
                          })}
                        </span>
                      )}
                      {log?.time && (
                        <span className="text-success text-xs font-medium">
                          {t('pages.nutritionLog.actualTime', {
                            time: log.time.slice(0, 5),
                          })}
                        </span>
                      )}
                    </div>
                    {log && (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {log.is_free_meal
                          ? t('pages.nutritionLog.freeMeal')
                          : (log.menu_option_name ?? t('pages.nutritionLog.done'))}
                      </p>
                    )}
                  </div>
                </div>

                <div className="gap-xs flex shrink-0 items-center">
                  {log ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit(log)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive h-7 w-7"
                        onClick={() => onDelete(log)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  ) : isLate ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-warning/50 hover:bg-warning/10 h-7 text-xs"
                      onClick={() => onRegister(mt.id)}
                    >
                      {t('pages.nutritionLog.registerMeal')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground h-7 text-xs"
                      onClick={() => onRegister(mt.id)}
                    >
                      {t('pages.nutritionLog.registerMeal')} →
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface FoodCardProps {
  food: Food;
  onEdit: () => void;
  onDelete: () => void;
}

function FoodCard({ food, onEdit, onDelete }: FoodCardProps) {
  const { t } = useTranslation();
  const initial = food.name.charAt(0).toUpperCase();
  return (
    <div className="group gap-sm border-border bg-card p-md hover:border-category-nutrition/40 flex items-center rounded-lg border transition-all hover:shadow-sm">
      <div className="bg-category-nutrition/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
        <span className="text-category-nutrition text-base font-bold">{initial}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="leading-snug font-semibold">{food.name}</p>
        <div className="gap-xs mt-0.5 flex flex-wrap items-center">
          {food.calories_per_serving && (
            <span className="inline-flex items-center gap-0.5 text-xs text-orange-500">
              <Flame className="h-3 w-3" />
              {food.calories_per_serving} kcal
            </span>
          )}
          {food.serving_size && food.serving_unit && (
            <span className="text-muted-foreground text-xs">
              {food.serving_size} {t(`units.${food.serving_unit}`, food.serving_unit)}
            </span>
          )}
        </div>
        {food.description && (
          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
            {food.description}
          </p>
        )}
      </div>
      <div className="gap-xs flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Edit className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive h-7 w-7"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Ingredient list with alternative groups ─────────────────────────────────

function calcCalories(ing: MenuOptionIngredient): number | null {
  if (!ing.food_calories_per_serving || !ing.food_serving_size) return null;
  const cals = parseFloat(ing.food_calories_per_serving);
  const servingSize = parseFloat(ing.food_serving_size);
  if (!servingSize) return null;
  const qty = ing.quantity ? parseFloat(ing.quantity) : servingSize;
  return Math.round((qty / servingSize) * cals);
}

function IngredientItem({ ing }: { ing: MenuOptionIngredient }) {
  const { t } = useTranslation();
  const cal = calcCalories(ing);
  return (
    <div className="gap-xs flex items-start">
      <div className="mt-xs bg-category-nutrition/50 h-1.5 w-1.5 shrink-0 rounded-full" />
      <span className="text-muted-foreground text-xs">
        <span className="text-foreground font-medium">{ing.food_name}</span>
        {ing.quantity ? ` — ${ing.quantity} ${ing.unit_display}` : ''}
        {cal != null && (
          <span className="ml-xs inline-flex items-center gap-0.5 text-orange-500">
            <Flame className="h-2.5 w-2.5" />
            {cal} {t('pages.nutritionMealTypes.ingredientKcal')}
          </span>
        )}
        {ing.is_optional && (
          <span className="ml-xs text-muted-foreground/60 italic">(opt.)</span>
        )}
        {ing.notes ? ` · ${ing.notes}` : ''}
      </span>
    </div>
  );
}

function IngredientList({ ingredients }: { ingredients: MenuOptionIngredient[] }) {
  const { t } = useTranslation();
  // Ingredients with the same alternative_group are alternatives (show with "OR").
  // Standalone ingredients (null/undefined alternative_group) are each their own entry.
  const groups: Map<number | string, MenuOptionIngredient[]> = new Map();
  for (const ing of ingredients) {
    const key =
      ing.alternative_group != null ? ing.alternative_group : `__solo_${ing.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ing);
  }

  const entries = Array.from(groups.entries()).sort(([a], [b]) => {
    const numA = typeof a === 'number' ? a : Infinity;
    const numB = typeof b === 'number' ? b : Infinity;
    return numA - numB;
  });

  return (
    <div className="gap-xs p-sm grid sm:grid-cols-2">
      {entries.map(([groupKey, items]) =>
        items.length === 1 ? (
          <IngredientItem key={items[0].id} ing={items[0]} />
        ) : (
          <div key={groupKey ?? `g-${items[0].id}`} className="space-y-xs">
            {items.map((ing, idx) => (
              <div key={ing.id}>
                <IngredientItem ing={ing} />
                {idx < items.length - 1 && (
                  <p className="text-category-nutrition/60 ml-3 text-[10px] font-semibold tracking-wider uppercase">
                    {t('pages.nutritionMealTypes.ingredientOr')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
