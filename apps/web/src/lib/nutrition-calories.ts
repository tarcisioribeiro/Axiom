import type { MenuOption, MenuOptionIngredient } from '@/types/nutrition';

/** Calorias de um ingrediente, ou null quando faltam dados da comida. */
export function calcCalories(ing: MenuOptionIngredient): number | null {
  if (!ing.food_calories_per_serving || !ing.food_serving_size) return null;
  const cals = parseFloat(ing.food_calories_per_serving);
  const servingSize = parseFloat(ing.food_serving_size);
  if (!servingSize) return null;
  const qty = ing.quantity ? parseFloat(ing.quantity) : servingSize;
  return Math.round((qty / servingSize) * cals);
}

/** Total de calorias de uma opção; null quando nenhum ingrediente tem dados. */
export function optionCalories(option: MenuOption): number | null {
  const values = option.ingredients
    .map(calcCalories)
    .filter((v): v is number => v != null);
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
}
