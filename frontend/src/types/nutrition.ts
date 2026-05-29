export interface Food {
  id: number;
  uuid: string;
  name: string;
  description?: string | null;
  owner: number;
  created_at: string;
  updated_at: string;
}

export interface FoodFormData {
  name: string;
  description?: string | null;
  owner: number;
}

export interface MealType {
  id: number;
  uuid: string;
  name: string;
  suggested_time?: string | null;
  order: number;
  is_active: boolean;
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
  owner: number;
}

export interface MenuOption {
  id: number;
  uuid: string;
  meal_type: number;
  name: string;
  order: number;
  ingredients: MenuOptionIngredient[];
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
  quantity?: string | null;
  unit: string;
  unit_display: string;
  is_optional: boolean;
  notes?: string | null;
  order: number;
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
