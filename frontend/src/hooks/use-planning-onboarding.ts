export const ONBOARDING_KEY = 'axiom-planning-onboarding-done';

export function usePlanningOnboarding() {
  const isDone = localStorage.getItem(ONBOARDING_KEY) === 'true';
  return { shouldShow: !isDone };
}
