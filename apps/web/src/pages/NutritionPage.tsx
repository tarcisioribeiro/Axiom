/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Edit,
  Flame,
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

import { Can } from '@/components/common/Can';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { GRID_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { FoodForm } from '@/components/nutrition/FoodForm';
import {
  HydrationGoalCard,
  WaterLogPanel,
  WaterTotal,
} from '@/components/nutrition/Hydration';
import { MealLogForm } from '@/components/nutrition/MealLogForm';
import { MealTypeForm } from '@/components/nutrition/MealTypeForm';
import { MenuOptionForm } from '@/components/nutrition/MenuOptionForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogCloseFooter,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TASK_STATUS_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useTabRoute } from '@/hooks/use-tab-route';
import { useToast } from '@/hooks/use-toast';
import { calcCalories } from '@/lib/nutrition-calories';
import { STALE_TIMES } from '@/lib/query-client';
import { cn, formatLocalDate, formatQuantity } from '@/lib/utils';
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

// 5 cards por linha × 5 linhas
const OPTIONS_PAGE_SIZE = 3;
// Limite de tipos de refeição por usuário (validado também no backend)
const MAX_MEAL_TYPES = 6;

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
  iconBg: string;
  iconColor: string;
  icon: ReactNode;
  label: string;
}

/** Ícone e cor do período da refeição (só no ícone e no rótulo; o card é neutro). */
function getMealPeriodTheme(time?: string | null): MealPeriodTheme {
  if (!time)
    return {
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      icon: <UtensilsCrossed className="text-muted-foreground h-5 w-5" />,
      label: '',
    };
  const h = parseInt(time.slice(0, 2));
  if (h >= 4 && h < 12)
    return {
      iconBg: 'bg-warning/15',
      iconColor: 'text-warning',
      icon:
        h < 9 ? (
          <Sunrise className="text-warning h-5 w-5" />
        ) : (
          <Sun className="text-warning h-5 w-5" />
        ),
      label: 'Manhã',
    };
  if (h >= 12 && h < 19)
    return {
      iconBg: 'bg-category-nutrition/15',
      iconColor: 'text-category-nutrition',
      icon: <Sun className="text-category-nutrition h-5 w-5" />,
      label: h < 15 ? 'Almoço' : 'Tarde',
    };
  return {
    iconBg: 'bg-info/15',
    iconColor: 'text-info',
    icon: <Moon className="text-info h-5 w-5" />,
    label: 'Noite',
  };
}

const TABS = ['log', 'meal-types', 'foods'] as const;

const TAB_HEADERS: Record<
  (typeof TABS)[number],
  { titleKey: string; icon: ReactNode }
> = {
  log: { titleKey: 'pages.nutritionFoods.tabLog', icon: <CalendarDays /> },
  'meal-types': {
    titleKey: 'pages.nutritionFoods.tabMealTypes',
    icon: <UtensilsCrossed />,
  },
  foods: { titleKey: 'pages.nutritionFoods.tabFoods', icon: <Salad /> },
};

export default function NutritionPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [optionsMealTypeId, setOptionsMealTypeId] = useState<number | null>(null);
  const [foodSearch, setFoodSearch] = useState('');
  const [mealTypeSearch, setMealTypeSearch] = useState('');
  const [mealTypeStatusFilter, setMealTypeStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useTabRoute('/planning/nutrition', TABS, 'log');
  const today = formatLocalDate(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(today);

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

  // Busca filtrada no backend: a lista sem filtro só traz a 1ª página, e
  // dias fora dela apareciam vazios no Diário.
  const { data: selectedLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['meal-logs', 'date', selectedDate],
    queryFn: () => mealLogService.getByDate(selectedDate),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const foods = foodsData ?? [];
  const mealTypes = mealTypesData ?? [];
  const activeMealTypes = mealTypes.filter((mt) => mt.is_active);
  const dayCalories = Math.round(
    selectedLogs.reduce((acc, log) => acc + log.calories, 0)
  );
  const adherencePct =
    activeMealTypes.length > 0
      ? Math.round((selectedLogs.length / activeMealTypes.length) * 100)
      : 0;

  const navigateDay = (delta: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(formatLocalDate(d));
  };

  const filteredFoods = foods.filter((f) =>
    f.name.toLowerCase().includes(foodSearch.toLowerCase())
  );

  const filteredMealTypes = mealTypes.filter((mt) => {
    if (mealTypeStatusFilter === 'active' && !mt.is_active) return false;
    if (mealTypeStatusFilter === 'inactive' && mt.is_active) return false;
    return mt.name.toLowerCase().includes(mealTypeSearch.toLowerCase());
  });
  const hasMealTypeFilters = !!mealTypeSearch || mealTypeStatusFilter !== 'all';

  // ── Mutations ─────────────────────────────────────────────────────────────

  const invalidateFoods = () => queryClient.invalidateQueries({ queryKey: ['foods'] });
  const invalidateMealTypes = () =>
    queryClient.invalidateQueries({ queryKey: ['meal-types'] });
  const invalidateLogs = () => {
    void queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
    // tarefas vinculadas à refeição são concluídas/reabertas pelo backend
    return queryClient.invalidateQueries({ queryKey: ['task-instances'] });
  };

  const createFoodMutation = useMutation({
    mutationFn: (data: FoodFormData) => foodService.create(data),
    onSuccess: () => {
      void invalidateFoods();
      toast({
        title: t('pages.nutritionFoods.foodCreated'),
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
      });
    },
  });

  const createMealTypeMutation = useMutation({
    mutationFn: (data: MealTypeFormData) => mealTypeService.create(data),
    onSuccess: () => {
      void invalidateMealTypes();
      toast({
        title: t('pages.nutritionMealTypes.mealTypeCreated'),
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
      });
    },
  });

  const createLogMutation = useMutation({
    mutationFn: (data: MealLogFormData) => mealLogService.create(data),
    onSuccess: () => {
      void invalidateLogs();
      toast({
        title: t('pages.nutritionLog.logCreated'),
      });
      setDialog(null);
    },
    onError: (err: unknown) => {
      toast({
        title: t('pages.nutritionLog.saveError', { reason: getErrorMessage(err) }),
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
      });
    },
    onError: (err: unknown) => {
      toast({
        title: t('pages.nutritionLog.deleteError', { reason: getErrorMessage(err) }),
        variant: 'destructive',
      });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDeleteOption = async (opt: MenuOption) => {
    const ok = await showConfirm({
      title: t('pages.nutritionMealTypes.deleteOptionTitle'),
      description: t('pages.nutritionMealTypes.deleteOptionDesc'),
    });
    if (ok) deleteOptionMutation.mutate(opt.id);
  };

  const optionsMealType = mealTypes.find((mt) => mt.id === optionsMealTypeId) ?? null;

  // Mesmo nome (sem diferença de maiúsculas/espaços) e mesmo horário = duplicata
  const isDuplicateMealType = (
    name: string,
    suggestedTime: string | null | undefined,
    ignoreId?: number
  ) => {
    const key = name.trim().split(/\s+/).join(' ').toLocaleLowerCase('pt-BR');
    const time = suggestedTime ? suggestedTime.slice(0, 5) : null;
    return mealTypes.some(
      (mt) =>
        mt.id !== ignoreId &&
        mt.name.trim().split(/\s+/).join(' ').toLocaleLowerCase('pt-BR') === key &&
        (mt.suggested_time ? mt.suggested_time.slice(0, 5) : null) === time
    );
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
    <PageContainer>
      <PageHeader
        title={t(TAB_HEADERS[activeTab].titleKey)}
        icon={TAB_HEADERS[activeTab].icon}
        actions={
          activeTab === 'meal-types' ? (
            <Can action="add">
              <Button
                disabled={mealTypes.length >= MAX_MEAL_TYPES}
                onClick={() => setDialog({ type: 'new-meal-type' })}
              >
                <Plus className="h-4 w-4" />
                {t('pages.nutritionMealTypes.newMealTypeBtn')}
              </Button>
            </Can>
          ) : activeTab === 'foods' ? (
            <Can action="add">
              <Button onClick={() => setDialog({ type: 'new-food' })}>
                <Plus className="h-4 w-4" />
                {t('pages.nutritionFoods.newFoodBtn')}
              </Button>
            </Can>
          ) : undefined
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as (typeof TABS)[number])}
        className="flex flex-1 flex-col"
      >
        <TabsList className="mb-lg w-full">
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

        {/* ── Diário ───────────────────────────────────────────────────── */}
        <TabsContent value="log" className="mt-0 flex-1">
          <div className="mb-lg">
            {/* Header card com aderência */}
            <div className="border-border bg-card overflow-hidden rounded-lg border">
              <div className="gap-md px-lg py-md flex items-center justify-between">
                <div className="min-w-0">
                  <div className="gap-sm flex flex-wrap items-center">
                    <p className="text-muted-foreground text-sm font-medium capitalize">
                      {selectedDateLabel}
                    </p>
                    <div className="gap-sm flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigateDay(-1)}
                        title={t('pages.nutritionLog.prevDay')}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="w-44">
                        <DatePicker
                          value={selectedDate}
                          onChange={(v) =>
                            setSelectedDate(v ? formatLocalDate(v) : today)
                          }
                          placeholder={t('pages.nutritionLog.selectDate')}
                          maxDate={today}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigateDay(1)}
                        disabled={selectedDate >= today}
                        title={t('pages.nutritionLog.nextDay')}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
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

                <div className="gap-md flex shrink-0 items-center">
                  <div className="text-right">
                    <span className="text-warning inline-flex items-center gap-0.5 text-2xl font-bold tabular-nums">
                      <Flame className="h-5 w-5" />
                      {dayCalories}
                    </span>
                    <p className="text-muted-foreground text-xs">kcal</p>
                  </div>
                  <WaterTotal date={selectedDate} />

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
                          className="stroke-category-nutrition duration-slow transition-[stroke-dashoffset]"
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
              </div>
            </div>
          </div>

          <div className="gap-lg grid items-start lg:grid-cols-2">
            <WaterLogPanel date={selectedDate} />

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
          </div>
        </TabsContent>

        {/* ── Plano Alimentar ──────────────────────────────────────────── */}
        <TabsContent value="meal-types" className="mt-0 flex-1">
          <div className="gap-lg grid items-start lg:grid-cols-2">
            <HydrationGoalCard />
            <div>
              <FilterBar
                className="mb-lg"
                hasActiveFilters={hasMealTypeFilters}
                onClear={() => {
                  setMealTypeSearch('');
                  setMealTypeStatusFilter('all');
                }}
              >
                <FilterField label={t('common.filterLabels.search')} icon={Search}>
                  <SearchInput
                    placeholder={t('pages.nutritionMealTypes.searchPlaceholder')}
                    value={mealTypeSearch}
                    onValueChange={setMealTypeSearch}
                  />
                </FilterField>
                <FilterField label={t('common.fields.status')} icon={CheckCircle2}>
                  <Select
                    value={mealTypeStatusFilter}
                    onValueChange={setMealTypeStatusFilter}
                  >
                    <SelectTrigger
                      className="w-36"
                      aria-label={t('pages.nutritionMealTypes.allStatus')}
                      startIcon={<CircleDot className="h-3.5 w-3.5" />}
                    >
                      <SelectValue
                        placeholder={t('pages.nutritionMealTypes.allStatus')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t('pages.nutritionMealTypes.allStatus')}
                      </SelectItem>
                      <SelectItem
                        value="active"
                        icon={<TASK_STATUS_ICONS.active className="h-4 w-4" />}
                      >
                        {t('pages.nutritionMealTypes.active')}
                      </SelectItem>
                      <SelectItem
                        value="inactive"
                        icon={<TASK_STATUS_ICONS.inactive className="h-4 w-4" />}
                      >
                        {t('pages.nutritionMealTypes.inactive')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FilterField>
              </FilterBar>

              {mealTypesLoading ? (
                <LoadingState />
              ) : filteredMealTypes.length === 0 ? (
                <EmptyState
                  title={t('pages.nutritionMealTypes.emptyMealTypes')}
                  icon={<UtensilsCrossed className="h-8 w-8" />}
                />
              ) : (
                <div className="space-y-sm">
                  {filteredMealTypes.map((mt) => (
                    <MealTypeCard
                      key={mt.id}
                      mealType={mt}
                      onOpenOptions={() => setOptionsMealTypeId(mt.id)}
                      onEdit={() => setDialog({ type: 'edit-meal-type', mealType: mt })}
                      onDelete={async () => {
                        const ok = await showConfirm({
                          title: t('pages.nutritionMealTypes.deleteMealTypeTitle'),
                          description: t('pages.nutritionMealTypes.deleteMealTypeDesc'),
                        });
                        if (ok) deleteMealTypeMutation.mutate(mt.id);
                      }}
                      t={t}
                    />
                  ))}
                </div>
              )}
              {mealTypes.length >= MAX_MEAL_TYPES && (
                <p className="text-muted-foreground mt-sm text-xs">
                  {t('pages.nutritionMealTypes.limitReached', {
                    max: MAX_MEAL_TYPES,
                  })}
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Alimentos ────────────────────────────────────────────────── */}
        <TabsContent value="foods" className="mt-0 flex-1">
          <FilterBar
            className="mb-lg"
            hasActiveFilters={!!foodSearch}
            onClear={() => setFoodSearch('')}
          >
            <FilterField label={t('common.filterLabels.search')} icon={Search}>
              <SearchInput
                placeholder={t('pages.nutritionFoods.searchPlaceholder')}
                value={foodSearch}
                onValueChange={setFoodSearch}
              />
            </FilterField>
          </FilterBar>

          {foodsLoading ? (
            <LoadingState />
          ) : filteredFoods.length === 0 ? (
            <EmptyState
              title={t('pages.nutritionFoods.emptyFoods')}
              icon={<Salad className="h-8 w-8" />}
            />
          ) : (
            <PaginatedSlide
              key={foodSearch}
              items={filteredFoods}
              pageSize={GRID_PAGE_SIZE}
              centerList
              className="gap-sm grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            >
              {(pageFoods) =>
                pageFoods.map((food) => (
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
                ))
              }
            </PaginatedSlide>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent
          className={cn('max-w-xl', dialog?.type.endsWith('option') && 'max-w-5xl')}
        >
          <DialogHeader>
            <DialogTitle mode={dialog?.type.startsWith('edit') ? 'edit' : 'create'}>
              {dialogTitle()}
            </DialogTitle>
            <DialogDescription className="sr-only">{dialogDesc()}</DialogDescription>
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

          {(dialog?.type === 'new-meal-type' || dialog?.type === 'edit-meal-type') && (
            <MealTypeForm
              mealType={dialog.type === 'edit-meal-type' ? dialog.mealType : undefined}
              ownerId={ownerId}
              onSubmit={async (data) => {
                const ignoreId =
                  dialog.type === 'edit-meal-type' ? dialog.mealType.id : undefined;
                if (isDuplicateMealType(data.name, data.suggested_time, ignoreId)) {
                  toast({
                    title: t('pages.nutritionMealTypes.duplicateMealType'),
                    variant: 'destructive',
                  });
                  return;
                }
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
        </DialogContent>
      </Dialog>

      {/* ── Dialog: opções da refeição (formulários abrem por cima) ───── */}
      <Dialog
        open={optionsMealType !== null}
        onOpenChange={(open) => !open && setOptionsMealTypeId(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="gap-sm flex items-center">
              {getMealPeriodTheme(optionsMealType?.suggested_time).icon}
              {optionsMealType?.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('pages.nutritionMealTypes.optionsDesc')}
            </DialogDescription>
          </DialogHeader>
          {optionsMealType && (
            <MealOptionsList
              mealType={optionsMealType}
              onEditOption={(opt) => setDialog({ type: 'edit-option', option: opt })}
              onDeleteOption={handleDeleteOption}
              t={t}
            />
          )}
          <DialogCloseFooter>
            {optionsMealType && (
              <Can action="add">
                <Button
                  onClick={() =>
                    setDialog({ type: 'new-option', mealTypeId: optionsMealType.id })
                  }
                >
                  <Plus className="h-4 w-4" />
                  {t('pages.nutritionMealTypes.newOptionBtn')}
                </Button>
              </Can>
            )}
          </DialogCloseFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface MealTypeCardProps {
  mealType: MealType;
  onOpenOptions: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string) => string;
}

function MealTypeCard({
  mealType,
  onOpenOptions,
  onEdit,
  onDelete,
  t,
}: MealTypeCardProps) {
  const theme = getMealPeriodTheme(mealType.suggested_time);

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      {/* Card header */}
      <div className="gap-sm px-md py-sm flex items-center">
        <button
          type="button"
          className="gap-sm flex min-w-0 flex-1 items-center text-left"
          onClick={onOpenOptions}
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
        </button>
        <div className="ml-sm gap-xs flex shrink-0 items-center">
          <Badge
            variant={mealType.is_active ? 'success' : 'secondary'}
            className="gap-xs"
          >
            {(() => {
              const StatusIcon =
                TASK_STATUS_ICONS[mealType.is_active ? 'active' : 'inactive'];
              return <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />;
            })()}
            {mealType.is_active
              ? t('pages.nutritionMealTypes.active')
              : t('pages.nutritionMealTypes.inactive')}
          </Badge>
          <Can action="change">
            <Button
              aria-label={t('common.actions.edit')}
              variant="ghost"
              size="icon"
              onClick={onEdit}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </Can>
          <Can action="delete">
            <Button
              aria-label={t('common.actions.delete')}
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Can>
        </div>
      </div>
    </div>
  );
}

interface MealOptionsListProps {
  mealType: MealType;
  onEditOption: (opt: MenuOption) => void;
  onDeleteOption: (opt: MenuOption) => void;
  t: (key: string) => string;
}

function MealOptionsList({
  mealType,
  onEditOption,
  onDeleteOption,
  t,
}: MealOptionsListProps) {
  return (
    <div>
      {mealType.options.length === 0 ? (
        <EmptyState title={t('pages.nutritionMealTypes.noIngredients')} />
      ) : (
        // Cada opção traz a lista de ingredientes: 3 por página (itens longos)
        <PaginatedSlide
          key={mealType.id}
          items={mealType.options}
          pageSize={OPTIONS_PAGE_SIZE}
          pinNav={false}
          className="space-y-sm"
        >
          {(pageOptions) =>
            pageOptions.map((opt) => (
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
                        <span className="text-warning inline-flex items-center gap-0.5 text-xs">
                          <Flame className="h-3 w-3" />
                          {total} kcal
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div className="gap-xs flex">
                    <Can action="change">
                      <Button
                        aria-label={t('common.actions.edit')}
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEditOption(opt)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </Can>
                    <Can action="delete">
                      <Button
                        aria-label={t('common.actions.delete')}
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive h-7 w-7"
                        onClick={() => onDeleteOption(opt)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </Can>
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
            ))
          }
        </PaginatedSlide>
      )}
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
            <div className="mb-xs border-border bg-card flex-1 overflow-hidden rounded-lg border">
              {/* Period label strip */}
              {theme.label && !log && !isLate && (
                <div
                  className={cn(
                    'px-sm text-2xs border-border border-b py-0.5 font-semibold tracking-wider uppercase',
                    theme.iconColor
                  )}
                >
                  {theme.label}
                </div>
              )}

              <div className="gap-sm p-sm flex items-center justify-between">
                <div className="gap-sm flex min-w-0 items-start">
                  <div
                    className={cn(
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                      log ? 'bg-success/15' : isLate ? 'bg-warning/15' : theme.iconBg
                    )}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={log ? 'done' : isLate ? 'late' : 'pending'}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center justify-center"
                      >
                        {log ? (
                          <CheckCircle2 className="text-success h-5 w-5" />
                        ) : isLate ? (
                          <AlertCircle className="text-warning h-5 w-5" />
                        ) : (
                          theme.icon
                        )}
                      </motion.span>
                    </AnimatePresence>
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
                  <AnimatePresence mode="wait" initial={false}>
                    {log ? (
                      <motion.div
                        key="done"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="gap-xs flex items-center"
                      >
                        {log.calories > 0 && (
                          <span className="mr-xs text-warning inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums">
                            <Flame className="h-3.5 w-3.5" />
                            {Math.round(log.calories)} kcal
                          </span>
                        )}
                        <Can action="change">
                          <Button
                            aria-label={t('common.actions.edit')}
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onEdit(log)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </Can>
                        <Can action="delete">
                          <Button
                            aria-label={t('common.actions.delete')}
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive h-7 w-7"
                            onClick={() => onDelete(log)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </Can>
                      </motion.div>
                    ) : isLate ? (
                      <motion.div
                        key="late"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <Can action="add">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-warning/50 hover:bg-warning/10 h-7 text-xs"
                            onClick={() => onRegister(mt.id)}
                          >
                            <Plus className="h-3 w-3" />
                            {t('pages.nutritionLog.registerMeal')}
                          </Button>
                        </Can>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="pending"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <Can action="add">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-foreground h-7 text-xs"
                            onClick={() => onRegister(mt.id)}
                          >
                            <Plus className="h-3 w-3" />
                            {t('pages.nutritionLog.registerMeal')} →
                          </Button>
                        </Can>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
    <div className="group gap-sm border-border bg-card p-md flex items-center rounded-lg border">
      <div className="bg-category-nutrition/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
        <span className="text-category-nutrition text-base font-bold">{initial}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="leading-snug font-semibold">{food.name}</p>
        <div className="gap-xs mt-0.5 flex flex-wrap items-center">
          {food.calories_per_serving && (
            <span className="text-warning inline-flex items-center gap-0.5 text-xs">
              <Flame className="h-3 w-3" />
              {Math.round(Number(food.calories_per_serving))} kcal
            </span>
          )}
          {food.serving_size && food.serving_unit && (
            <span className="text-muted-foreground text-xs">
              {formatQuantity(t, food.serving_size, food.serving_unit)}
            </span>
          )}
        </div>
        {food.description && (
          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
            {food.description}
          </p>
        )}
      </div>
      <div className="gap-xs flex shrink-0">
        <Can action="change">
          <Button
            aria-label={t('common.actions.edit')}
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onEdit}
          >
            <Edit className="h-3 w-3" />
          </Button>
        </Can>
        <Can action="delete">
          <Button
            aria-label={t('common.actions.delete')}
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive h-7 w-7"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </Can>
      </div>
    </div>
  );
}

// ── Ingredient list with alternative groups ─────────────────────────────────

function IngredientItem({ ing }: { ing: MenuOptionIngredient }) {
  const { t } = useTranslation();
  const cal = calcCalories(ing);
  return (
    <div className="gap-xs flex items-start">
      <div className="mt-xs bg-category-nutrition/50 h-1.5 w-1.5 shrink-0 rounded-full" />
      <span className="text-muted-foreground text-xs">
        <span className="text-foreground font-medium">{ing.food_name}</span>
        {ing.quantity ? ` — ${formatQuantity(t, ing.quantity, ing.unit)}` : ''}
        {cal != null && (
          <span className="ml-xs text-warning inline-flex items-center gap-0.5">
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
                  <p className="text-category-nutrition/60 text-2xs ml-sm font-semibold tracking-wider uppercase">
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
