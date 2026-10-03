/**
 * Repetições sugeridas da série `index` (0-based): descem em linha reta do
 * máximo (1ª série) ao mínimo (última). Ex.: 3 séries de 8–12 → 12, 10, 8.
 */
export function degradedReps(
  index: number,
  sets: number,
  repsMin: number,
  repsMax: number
): number {
  if (sets <= 1) return repsMax;
  return Math.round(repsMax - ((repsMax - repsMin) * index) / (sets - 1));
}
