/* eslint-disable max-lines */
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Dumbbell,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ONBOARDING_KEY } from '@/hooks/use-planning-onboarding';
import { slideVariants } from '@/lib/animations';
import { cn } from '@/lib/utils';
import { routineTemplatesService } from '@/services/routine-templates-service';
import type { RoutineTemplate } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const TEMPLATE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  morning_routine: Calendar,
  study_routine: BookOpen,
  health_and_exercise: Dumbbell,
};

interface PlanningOnboardingProps {
  onDone: () => void;
}

export function PlanningOnboarding({ onDone }: PlanningOnboardingProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templatesFetched, setTemplatesFetched] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  useEffect(() => {
    if (step !== 1 || templatesFetched) return;
    routineTemplatesService
      .getAll()
      .then((data) => {
        setTemplates(data);
        setTemplatesFetched(true);
      })
      .catch(() => {
        setTemplatesFetched(true);
      });
  }, [step, templatesFetched]);

  const isLoadingTemplates = step === 1 && !templatesFetched;

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    onDone();
  };

  const handleImportAndFinish = async () => {
    if (!selectedTemplateId) {
      localStorage.setItem(ONBOARDING_KEY, 'true');
      onDone();
      return;
    }
    setIsImporting(true);
    setImportError(null);
    try {
      await routineTemplatesService.importTemplate(selectedTemplateId);
      setImportSuccess(true);
      setTimeout(() => {
        localStorage.setItem(ONBOARDING_KEY, 'true');
        onDone();
      }, 1200);
    } catch (error) {
      setImportError(getErrorMessage(error));
      setIsImporting(false);
    }
  };

  const TOTAL_STEPS = 3;
  const isLastStep = step === TOTAL_STEPS - 1;

  // Direção da troca de etapa: avança para a esquerda, volta para a direita
  const [direction, setDirection] = useState(1);
  const goToStep = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const header = importSuccess
    ? { icon: CheckCircle2, title: t('pages.planningOnboarding.step2.success') }
    : [
        { icon: Sparkles, title: t('pages.planningOnboarding.step0.title') },
        { icon: Target, title: t('pages.planningOnboarding.step1.title') },
        { icon: CheckCircle2, title: t('pages.planningOnboarding.step2.title') },
      ][step];

  return (
    <Dialog open onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle icon={header.icon}>{header.title}</DialogTitle>
          <DialogDescription>{header.title}</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={importSuccess ? 'success' : step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-md"
            >
              {/* Step 0: Welcome */}
              {step === 0 && (
                <p className="text-muted-foreground text-sm">
                  {t('pages.planningOnboarding.step0.desc')}
                </p>
              )}

              {/* Step 1: Choose template */}
              {step === 1 &&
                (isLoadingTemplates ? (
                  <LoadingState />
                ) : (
                  <div className="space-y-sm">
                    {templates.map((template) => {
                      const Icon = TEMPLATE_ICONS[template.id] ?? CheckCircle2;
                      const isSelected = selectedTemplateId === template.id;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() =>
                            setSelectedTemplateId(isSelected ? null : template.id)
                          }
                          className={cn(
                            'p-md w-full rounded-lg border text-left transition-colors',
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-card hover:border-primary/50'
                          )}
                        >
                          <div className="gap-sm flex items-start">
                            <div
                              className={cn(
                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                                isSelected
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">{template.name}</p>
                              <p className="mt-xs text-muted-foreground line-clamp-2 text-xs">
                                {template.description}
                              </p>
                              <p className="mt-xs text-primary text-xs">
                                {t('pages.routineTemplates.taskCount', {
                                  count: template.task_count,
                                  defaultValue: `${template.task_count} tarefas`,
                                })}
                              </p>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="text-primary h-5 w-5 shrink-0" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      aria-pressed={selectedTemplateId === null}
                      onClick={() => setSelectedTemplateId(null)}
                      className={cn(
                        'p-md text-muted-foreground w-full rounded-lg border text-left text-sm transition-colors',
                        selectedTemplateId === null
                          ? 'border-muted-foreground bg-muted/30'
                          : 'border-border hover:border-muted-foreground/50'
                      )}
                    >
                      {t('pages.planningOnboarding.skipTemplate')}
                    </button>
                  </div>
                ))}

              {/* Step 2: Confirm / result */}
              {isLastStep && (
                <>
                  <p className="text-muted-foreground text-sm">
                    {importSuccess
                      ? t('pages.planningOnboarding.step2.successDesc')
                      : selectedTemplateId
                        ? t('pages.planningOnboarding.step2.descWithTemplate')
                        : t('pages.planningOnboarding.step2.descWithout')}
                  </p>
                  {importError && (
                    <p className="text-destructive text-sm">{importError}</p>
                  )}
                </>
              )}

              {/* Step dots */}
              {!importSuccess && (
                <div className="gap-xs flex justify-center">
                  {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-1.5 rounded-full transition-[width,background-color]',
                        i === step ? 'bg-primary w-6' : 'bg-muted w-1.5'
                      )}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {importSuccess ? (
          <DialogCloseFooter />
        ) : (
          <DialogFooter className="gap-sm">
            <Button variant="outline" onClick={handleSkip}>
              <X className="h-4 w-4" />
              {t('common.actions.cancel')}
            </Button>
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => goToStep(step - 1)}
                disabled={isImporting}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('common.actions.back')}
              </Button>
            )}
            {isLastStep ? (
              <Button
                onClick={() => void handleImportAndFinish()}
                loading={isImporting}
              >
                {!isImporting && <ArrowRight className="h-4 w-4" />}
                {isImporting
                  ? t('pages.planningOnboarding.importing')
                  : t('pages.planningOnboarding.start')}
              </Button>
            ) : (
              <Button onClick={() => goToStep(step + 1)}>
                <ArrowRight className="h-4 w-4" />
                {t('pages.planningOnboarding.next')}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
