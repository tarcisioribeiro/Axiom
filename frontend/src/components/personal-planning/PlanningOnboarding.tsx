import { motion } from 'framer-motion';
import { CheckCircle2, Dumbbell, Target, Calendar, ArrowRight, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ONBOARDING_KEY } from '@/hooks/use-planning-onboarding';

const STEPS = [
  { icon: Calendar, colorClass: 'bg-primary/10 text-primary' },
  { icon: CheckCircle2, colorClass: 'bg-success/10 text-success' },
  { icon: Target, colorClass: 'bg-info/10 text-info' },
  { icon: Dumbbell, colorClass: 'bg-warning/10 text-warning' },
] as const;

interface PlanningOnboardingProps {
  onDone: () => void;
}

export function PlanningOnboarding({ onDone }: PlanningOnboardingProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  const isLast = step === STEPS.length - 1;
  const StepIcon = STEPS[step].icon;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem(ONBOARDING_KEY, 'true');
      onDone();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        key={step}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="relative mx-md w-full max-w-md rounded-2xl border border-border bg-card p-xl shadow-2xl"
      >
        <button
          onClick={handleSkip}
          className="absolute right-md top-md text-muted-foreground hover:text-foreground"
          aria-label={t('common.actions.close')}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-lg text-center">
          <div
            className={`mx-auto mb-md flex h-16 w-16 items-center justify-center rounded-2xl ${STEPS[step].colorClass}`}
          >
            <StepIcon className="h-8 w-8" />
          </div>
          <h2 className="heading-2 text-foreground">
            {t(`pages.planningOnboarding.step${step}.title`)}
          </h2>
          <p className="mt-sm text-sm text-muted-foreground">
            {t(`pages.planningOnboarding.step${step}.desc`)}
          </p>
        </div>

        <div className="mb-lg flex justify-center gap-xs">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-sm">
          {!isLast && (
            <Button variant="ghost" size="sm" onClick={handleSkip} className="flex-1">
              {t('pages.planningOnboarding.skip')}
            </Button>
          )}
          <Button onClick={handleNext} className="flex-1 gap-sm">
            {isLast
              ? t('pages.planningOnboarding.start')
              : t('pages.planningOnboarding.next')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
