/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit,
  Moon,
  Plus,
  Salad,
  Search,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
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
  | null;

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
      icon: <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />,
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
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [expandedMealTypes, setExpandedMealTypes] = useState<Set<number>>(new Set());
  const [foodSearch, setFoodSearch] = useState('');

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

  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter((l) => l.date === today);
  const activeMealTypes = mealTypes.filter((mt) => mt.is_active);
  const adherencePct =
    activeMealTypes.length > 0
      ? Math.round((todayLogs.length / activeMealTypes.length) * 100)
      : 0;

  const filteredFoods = foods.filter((f) =>
    f.name.toLowerCase().includes(foodSearch.toLowerCase())
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  const invalidateFoods = () => queryClient.invalidateQueries({ queryKey: ['foods'] });
  const invalidateMealTypes = () =>
    queryClient.invalidateQueries({ queryKey: ['meal-types'] });
  const invalidateLogs = () =>
    queryClient.invalidateQueries({ queryKey: ['meal-logs'] });

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
    }
  };

  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

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
          icon={<UtensilsCrossed className="h-6 w-6 text-category-nutrition" />}
        />

        <Tabs defaultValue="log" className="flex flex-1 flex-col">
          <TabsList className="mb-lg w-full">
            <TabsTrigger value="log" className="flex-1 gap-xs">
              <CalendarDays className="h-4 w-4" />
              {t('pages.nutritionFoods.tabLog')}
            </TabsTrigger>
            <TabsTrigger value="meal-types" className="flex-1 gap-xs">
              <UtensilsCrossed className="h-4 w-4" />
              {t('pages.nutritionFoods.tabMealTypes')}
            </TabsTrigger>
            <TabsTrigger value="foods" className="flex-1 gap-xs">
              <Salad className="h-4 w-4" />
              {t('pages.nutritionFoods.tabFoods')}
            </TabsTrigger>
          </TabsList>

          {/* ── Diário ───────────────────────────────────────────────────── */}
          <TabsContent value="log" className="mt-0 flex-1">
            {/* Header card com aderência */}
            <div className="mb-lg overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between gap-md px-lg py-md">
                <div className="min-w-0">
                  <p className="text-sm font-medium capitalize text-muted-foreground">
                    {todayLabel}
                  </p>
                  <div className="mt-xs flex items-baseline gap-xs">
                    <span className="text-4xl font-bold tabular-nums text-category-nutrition">
                      {todayLogs.length}
                    </span>
                    <span className="text-xl text-muted-foreground">
                      / {activeMealTypes.length}
                    </span>
                  </div>
                  <p className="mt-xs text-sm text-muted-foreground">
                    {t('pages.nutritionLog.mealsLogged', {
                      logged: todayLogs.length,
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
                      <span className="text-sm font-bold text-category-nutrition">
                        {adherencePct}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border px-lg py-sm">
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
                logs={todayLogs}
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
            <div className="mb-md flex justify-end">
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
            <div className="mb-md flex items-center gap-sm">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t('pages.nutritionFoods.searchPlaceholder')}
                  value={foodSearch}
                  onChange={(e) => setFoodSearch(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background py-sm pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
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
              />
            ) : (
              <div className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3">
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
          'flex items-center gap-sm px-md py-sm',
          mealType.is_active ? theme.cardBg : 'bg-card'
        )}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-sm text-left"
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
            <p className="font-semibold leading-snug">{mealType.name}</p>
            <div className="mt-0.5 flex items-center gap-sm">
              {mealType.suggested_time && (
                <span
                  className={cn(
                    'flex items-center gap-xs text-xs font-medium',
                    mealType.is_active ? theme.iconColor : 'text-muted-foreground'
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {mealType.suggested_time.slice(0, 5)}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {mealType.options.length}{' '}
                {mealType.options.length === 1
                  ? t('pages.nutritionMealTypes.optionSingular')
                  : t('pages.nutritionMealTypes.optionPlural')}
              </span>
            </div>
          </div>
          {expanded ? (
            <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>
        <div className="ml-sm flex shrink-0 items-center gap-xs">
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
            <div className="border-t border-border bg-card p-md">
              <div className="mb-sm flex justify-end">
                <Button variant="outline" size="sm" onClick={onNewOption}>
                  <Plus className="mr-xs h-3 w-3" />
                  {t('pages.nutritionMealTypes.newOptionBtn')}
                </Button>
              </div>
              {mealType.options.length === 0 ? (
                <p className="py-sm text-center text-xs text-muted-foreground">
                  {t('pages.nutritionMealTypes.noIngredients')}
                </p>
              ) : (
                <div className="space-y-sm">
                  {mealType.options.map((opt) => (
                    <div
                      key={opt.id}
                      className="overflow-hidden rounded-lg border border-border bg-muted/20"
                    >
                      {/* Option header */}
                      <div className="flex items-center justify-between border-b border-border/60 bg-card px-sm py-xs">
                        <div className="flex items-center gap-xs">
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-category-nutrition/10">
                            <BookOpen className="h-3.5 w-3.5 text-category-nutrition" />
                          </div>
                          <span className="text-sm font-semibold">{opt.name}</span>
                        </div>
                        <div className="flex gap-xs">
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
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => onDeleteOption(opt)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {/* Ingredients */}
                      {opt.ingredients.length > 0 ? (
                        <div className="grid gap-xs p-sm sm:grid-cols-2">
                          {opt.ingredients.map((ing) => (
                            <div key={ing.id} className="flex items-start gap-xs">
                              <div className="mt-xs h-1.5 w-1.5 shrink-0 rounded-full bg-category-nutrition/50" />
                              <span className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  {ing.food_name}
                                </span>
                                {ing.quantity
                                  ? ` — ${ing.quantity} ${ing.unit_display}`
                                  : ''}
                                {ing.is_optional && (
                                  <span className="ml-xs italic text-muted-foreground/60">
                                    (opt.)
                                  </span>
                                )}
                                {ing.notes ? ` · ${ing.notes}` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="px-sm py-xs text-xs text-muted-foreground">
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
          <div key={mt.id} className="flex gap-sm">
            {/* Timeline spine */}
            <div className="flex shrink-0 flex-col items-center pt-md">
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
                <div className="mt-xs w-0.5 flex-1 bg-border" />
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
                    'border-b px-sm py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                    theme.border,
                    theme.iconColor
                  )}
                >
                  {theme.label}
                </div>
              )}

              <div className="flex items-start justify-between gap-sm p-sm">
                <div className="flex min-w-0 items-start gap-sm">
                  <div
                    className={cn(
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      log ? 'bg-success/15' : isLate ? 'bg-warning/15' : theme.iconBg
                    )}
                  >
                    {log ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : isLate ? (
                      <AlertCircle className="h-5 w-5 text-warning" />
                    ) : (
                      theme.icon
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{mt.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-xs">
                      {mt.suggested_time && (
                        <span className="flex items-center gap-xs text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {t('pages.nutritionLog.suggestedTime', {
                            time: mt.suggested_time.slice(0, 5),
                          })}
                        </span>
                      )}
                      {log?.time && (
                        <span className="text-xs font-medium text-success">
                          {t('pages.nutritionLog.actualTime', {
                            time: log.time.slice(0, 5),
                          })}
                        </span>
                      )}
                    </div>
                    {log && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {log.is_free_meal
                          ? t('pages.nutritionLog.freeMeal')
                          : (log.menu_option_name ?? t('pages.nutritionLog.done'))}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-xs">
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
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onDelete(log)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  ) : isLate ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-warning/50 text-xs hover:bg-warning/10"
                      onClick={() => onRegister(mt.id)}
                    >
                      {t('pages.nutritionLog.registerMeal')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
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
  const initial = food.name.charAt(0).toUpperCase();
  return (
    <div className="group flex items-center gap-sm rounded-lg border border-border bg-card p-md transition-all hover:border-category-nutrition/40 hover:shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-category-nutrition/10">
        <span className="text-base font-bold text-category-nutrition">{initial}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{food.name}</p>
        {food.description ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {food.description}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground/50">—</p>
        )}
      </div>
      <div className="flex shrink-0 gap-xs opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Edit className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
