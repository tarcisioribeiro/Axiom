/* eslint-disable max-lines */
import {
  CheckCircleIcon as CheckCircle2,
  FireIcon as Dumbbell,
  ViewfinderCircleIcon as Target,
  CalendarIcon as Calendar,
  ArrowRightIcon as ArrowRight,
  XMarkIcon as X,
  BookOpenIcon as BookOpen,
  ArrowPathIcon as Loader2,
  SparklesIcon as Sparkles,
} from '@heroicons/react/24/solid';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ONBOARDING_KEY } from '@/hooks/use-planning-onboarding';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        key={step}
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="mx-md border-border bg-card p-xl relative w-full max-w-lg rounded-2xl border shadow-2xl"
      >
        <button
          onClick={handleSkip}
          className="right-md top-md text-muted-foreground hover:text-foreground absolute"
          aria-label={t('common.actions.close')}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center">
            <div className="mb-md bg-primary/10 text-primary mx-auto flex h-16 w-16 items-center justify-center rounded-2xl">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2 className="heading-2 text-foreground">
              {t('pages.planningOnboarding.step0.title')}
            </h2>
            <p className="mt-sm text-muted-foreground text-sm">
              {t('pages.planningOnboarding.step0.desc')}
            </p>
          </div>
        )}

        {/* Step 1: Choose template */}
        {step === 1 && (
          <div>
            <div className="mb-md text-center">
              <div className="mb-md bg-info/10 text-info mx-auto flex h-16 w-16 items-center justify-center rounded-2xl">
                <Target className="h-8 w-8" />
              </div>
              <h2 className="heading-2 text-foreground">
                {t('pages.planningOnboarding.step1.title', {
                  defaultValue: 'Escolha uma rotina inicial',
                })}
              </h2>
              <p className="mt-sm text-muted-foreground text-sm">
                {t('pages.planningOnboarding.step1.desc', {
                  defaultValue:
                    'Selecione um template para começar. Você pode personalizar depois.',
                })}
              </p>
            </div>
            {isLoadingTemplates ? (
              <div className="py-lg flex items-center justify-center">
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="space-y-sm">
                {templates.map((template) => {
                  const Icon = TEMPLATE_ICONS[template.id] ?? CheckCircle2;
                  const isSelected = selectedTemplateId === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() =>
                        setSelectedTemplateId(isSelected ? null : template.id)
                      }
                      className={`p-md w-full rounded-xl border-2 text-left transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      <div className="gap-sm flex items-start">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                            isSelected
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}
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
                  onClick={() => setSelectedTemplateId(null)}
                  className={`p-md text-muted-foreground w-full rounded-xl border-2 text-left text-sm transition-colors ${
                    selectedTemplateId === null
                      ? 'border-muted-foreground bg-muted/30'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  {t('pages.planningOnboarding.skipTemplate', {
                    defaultValue: 'Começar sem template — criar manualmente',
                  })}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === 2 && (
          <div className="text-center">
            <AnimatePresence mode="wait">
              {importSuccess ? (
                <motion.div
                  key="success"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="py-md"
                >
                  <div className="mb-md bg-success/10 text-success mx-auto flex h-16 w-16 items-center justify-center rounded-2xl">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h2 className="heading-2 text-foreground">
                    {t('pages.planningOnboarding.step2.success', {
                      defaultValue: 'Rotina criada com sucesso!',
                    })}
                  </h2>
                  <p className="mt-sm text-muted-foreground text-sm">
                    {t('pages.planningOnboarding.step2.successDesc', {
                      defaultValue: 'Suas tarefas estão prontas. Bom planejamento!',
                    })}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="mb-md bg-success/10 text-success mx-auto flex h-16 w-16 items-center justify-center rounded-2xl">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h2 className="heading-2 text-foreground">
                    {t('pages.planningOnboarding.step2.title', {
                      defaultValue: 'Tudo pronto!',
                    })}
                  </h2>
                  <p className="mt-sm text-muted-foreground text-sm">
                    {selectedTemplateId
                      ? t('pages.planningOnboarding.step2.descWithTemplate', {
                          defaultValue:
                            'Clique em Começar para importar o template e iniciar sua jornada.',
                        })
                      : t('pages.planningOnboarding.step2.descWithout', {
                          defaultValue:
                            'Você pode criar suas primeiras tarefas manualmente quando quiser.',
                        })}
                  </p>
                  {importError && (
                    <p className="mt-sm text-destructive text-sm">{importError}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Step dots */}
        <div className="my-lg gap-xs flex justify-center">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-[width,background-color] ${
                i === step ? 'bg-primary w-6' : 'bg-muted w-1.5'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="gap-sm flex">
          {step < TOTAL_STEPS - 1 && (
            <Button variant="ghost" size="sm" onClick={handleSkip} className="flex-1">
              {t('pages.planningOnboarding.skip')}
            </Button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} className="gap-sm flex-1">
              {t('pages.planningOnboarding.next')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => void handleImportAndFinish()}
              className="gap-sm flex-1"
              disabled={isImporting || importSuccess}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('pages.planningOnboarding.importing', {
                    defaultValue: 'Importando...',
                  })}
                </>
              ) : (
                <>
                  {t('pages.planningOnboarding.start')}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
