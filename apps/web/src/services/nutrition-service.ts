import { API_CONFIG } from '@/config/api-config';
import type {
  Food,
  FoodFormData,
  HydrationGoal,
  HydrationSuggestion,
  MealLog,
  MealLogFormData,
  MealType,
  MealTypeFormData,
  MenuOption,
  MenuOptionFormData,
  MenuOptionIngredient,
  MenuOptionIngredientFormData,
  WaterLog,
  WaterLogFormData,
} from '@/types/nutrition';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class FoodService extends BaseService<Food, FoodFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.FOODS);
  }

  async search(query: string): Promise<Food[]> {
    return this.getAll({ search: query });
  }
}

class MealTypeService extends BaseService<MealType, MealTypeFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.MEAL_TYPES);
  }

  async getActive(): Promise<MealType[]> {
    return this.getAll({ is_active: true });
  }
}

class MenuOptionService extends BaseService<MenuOption, MenuOptionFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.MENU_OPTIONS);
  }

  async getByMealType(mealTypeId: number): Promise<MenuOption[]> {
    return this.getAll({ meal_type: mealTypeId });
  }
}

class MenuOptionIngredientService extends BaseService<
  MenuOptionIngredient,
  MenuOptionIngredientFormData
> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.MENU_OPTION_INGREDIENTS);
  }

  async getByMenuOption(menuOptionId: number): Promise<MenuOptionIngredient[]> {
    return this.getAll({ menu_option: menuOptionId });
  }
}

class MealLogService extends BaseService<MealLog, MealLogFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.MEAL_LOGS);
  }

  async getByDate(date: string): Promise<MealLog[]> {
    return this.getAll({ date });
  }

  async getByDateRange(dateFrom: string, dateTo: string): Promise<MealLog[]> {
    return this.getAll({ date_from: dateFrom, date_to: dateTo });
  }
}

class WaterLogService extends BaseService<WaterLog, WaterLogFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.WATER_LOGS);
  }

  async getByDate(date: string): Promise<WaterLog[]> {
    return this.getAll({ date });
  }
}

export const hydrationGoalService = {
  get: () => apiClient.get<HydrationGoal>(API_CONFIG.ENDPOINTS.HYDRATION_GOAL),
  save: (daily_target_ml: number) =>
    apiClient.put<HydrationGoal>(API_CONFIG.ENDPOINTS.HYDRATION_GOAL, {
      daily_target_ml,
    }),
  getSuggestion: () =>
    apiClient.get<HydrationSuggestion>(API_CONFIG.ENDPOINTS.HYDRATION_SUGGESTION),
};

export const foodService = new FoodService();
export const mealTypeService = new MealTypeService();
export const menuOptionService = new MenuOptionService();
export const menuOptionIngredientService = new MenuOptionIngredientService();
export const mealLogService = new MealLogService();
export const waterLogService = new WaterLogService();
