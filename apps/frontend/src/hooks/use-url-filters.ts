import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type StringFilterValue = string | string[];
type FilterSchema = Record<string, StringFilterValue>;

type SetFilter<T extends FilterSchema> = <K extends keyof T>(
  key: K,
  value: T[K]
) => void;

interface UseUrlFiltersReturn<T extends FilterSchema> {
  filters: T;
  setFilter: SetFilter<T>;
  resetFilters: () => void;
  hasActiveFilters: boolean;
}

/**
 * Synchronizes page filter state bidirectionally with URL search params.
 * Uses `replace` so filter changes don't create extra browser history entries.
 *
 * Supports two value shapes:
 *   - string   → single param   (?category=food)
 *   - string[] → comma-joined   (?accounts=1,2,3)
 *
 * @param defaults  The "empty" / reset values for every filter key.
 *                  A filter is considered active when it differs from its default.
 */
export function useUrlFilters<T extends FilterSchema>(
  defaults: T
): UseUrlFiltersReturn<T> {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const raw = searchParams.get(key);
      if (raw === null) continue;

      const defaultVal = defaults[key];
      if (Array.isArray(defaultVal)) {
        result[key as keyof T] = (raw ? raw.split(',') : []) as T[keyof T];
      } else {
        result[key as keyof T] = raw as T[keyof T];
      }
    }
    return result;
  }, [searchParams, defaults]);

  const setFilter: SetFilter<T> = useCallback(
    (key, value) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const k = key as string;
          const defaultVal = defaults[key];

          const isDefault = Array.isArray(value)
            ? value.length === 0
            : value === defaultVal;

          if (isDefault) {
            next.delete(k);
          } else if (Array.isArray(value)) {
            next.set(k, value.join(','));
          } else {
            next.set(k, String(value));
          }

          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams, defaults]
  );

  const resetFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const hasActiveFilters = useMemo(() => {
    for (const key of Object.keys(defaults)) {
      const current = filters[key];
      const def = defaults[key];
      if (Array.isArray(current)) {
        if (current.length > 0) return true;
      } else if (current !== def) {
        return true;
      }
    }
    return false;
  }, [filters, defaults]);

  return { filters, setFilter, resetFilters, hasActiveFilters };
}
