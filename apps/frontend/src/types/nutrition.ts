export interface Food {
  id: number;
  uuid: string;
  name: string;
  description?: string | null;
  calories_per_serving?: string | null;
  serving_size?: string | null;
  serving_unit?: string | null;
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface FoodFormData {
  name: string;
  description?: string | null;
  calories_per_serving?: string | null;
  serving_size?: string | null;
  serving_unit?: string | null;
  owner: number;
}

export interface MealType {
  id: number;
  uuid: string;
  name: string;
  suggested_time?: string | null;
  order: number;
  is_active: boolean;
  /** Opção usada ao registrar pela tarefa; null = a de maior caloria. */
  default_menu_option?: number | null;
  options: MenuOption[];
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface MealTypeFormData {
  name: string;
  suggested_time?: string | null;
  order: number;
  is_active: boolean;
  default_menu_option?: number | null;
  owner: number;
}

export interface MenuOption {
  id: number;
  uuid: string;
  meal_type: number;
  name: string;
  order: number;
  ingredients: MenuOptionIngredient[];
  /** Kcal dos ingredientes não opcionais (calculado no backend). */
  calories?: number;
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface MenuOptionFormData {
  meal_type: number;
  name: string;
  order: number;
  owner: number;
}

export interface MenuOptionIngredient {
  id: number;
  uuid: string;
  menu_option: number;
  food: number;
  food_name: string;
  food_calories_per_serving?: string | null;
  food_serving_size?: string | null;
  food_serving_unit?: string | null;
  quantity?: string | null;
  unit: string;
  unit_display: string;
  is_optional: boolean;
  notes?: string | null;
  order: number;
  alternative_group?: number | null;
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface MenuOptionIngredientFormData {
  menu_option: number;
  food: number;
  quantity?: string | null;
  unit: string;
  is_optional: boolean;
  notes?: string | null;
  order: number;
  alternative_group?: number | null;
  owner: number;
}

export interface MealLog {
  id: number;
  uuid: string;
  meal_type: number;
  meal_type_name: string;
  meal_type_suggested_time?: string | null;
  menu_option?: number | null;
  menu_option_name?: string | null;
  is_free_meal: boolean;
  /** Kcal computed server-side from the followed menu option (0 when free). */
  calories: number;
  date: string;
  time?: string | null;
  notes?: string | null;
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface MealLogFormData {
  meal_type: number;
  menu_option?: number | null;
  is_free_meal: boolean;
  date: string;
  time?: string | null;
  notes?: string | null;
  owner: number;
}

export interface HydrationGoal {
  id: number | null;
  /** null quando o usuário ainda não definiu a meta. */
  daily_target_ml: number | null;
}

export interface HydrationSuggestion {
  suggested_ml: number | null;
  weight_kg: number | null;
  measured_at: string | null;
  base_ml: number | null;
  ml_per_kg: number;
  training_days_per_week: number;
  training_minutes_per_week: number;
  exercise_ml: number;
}

export interface WaterLog {
  id: number;
  date: string;
  time?: string | null;
  amount_ml: number;
  /** true quando o registro veio da conclusão de uma tarefa vinculada. */
  from_task: boolean;
  created_at: string;
}

export interface WaterLogFormData {
  date: string;
  time?: string | null;
  amount_ml: number;
}
