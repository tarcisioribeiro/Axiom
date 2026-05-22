import { API_CONFIG } from '@/config/api-config';
import type {
  Food,
  FoodFormData,
  MealLog,
  MealLogFormData,
  MealType,
  MealTypeFormData,
  MenuOption,
  MenuOptionFormData,
  MenuOptionIngredient,
  MenuOptionIngredientFormData,
} from '@/types/nutrition';

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

export const foodService = new FoodService();
export const mealTypeService = new MealTypeService();
export const menuOptionService = new MenuOptionService();
export const menuOptionIngredientService = new MenuOptionIngredientService();
export const mealLogService = new MealLogService();
