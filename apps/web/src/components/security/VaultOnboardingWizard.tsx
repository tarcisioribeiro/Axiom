import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  FileArchive,
  KeyRound,
  Lock,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { StepNav } from '@/components/common/StepNav';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { slideVariants } from '@/lib/animations';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'vault_onboarding_completed';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Boas-vindas do cofre em etapas (§2.4), no mesmo formato do Planejamento Pessoal. */
export function VaultOnboardingWizard({ open, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const steps = [
    { icon: Lock, title: t('vaultOnboarding.step1Title') },
    { icon: KeyRound, title: t('vaultOnboarding.step2Title') },
    { icon: CheckCircle2, title: t('vaultOnboarding.step3Title') },
  ];
  const isLast = step === steps.length - 1;

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onClose();
  };

  const handleAction = (path: string) => {
    handleComplete();
    void navigate(path);
  };

  const shortcuts = [
    { icon: KeyRound, label: 'step3AddPassword', path: '/security/passwords' },
    { icon: ShieldCheck, label: 'step3HealthReport', path: '/security/health' },
    { icon: FileArchive, label: 'step3StoreArchive', path: '/security/archives' },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleComplete()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle icon={steps[step].icon}>{steps[step].title}</DialogTitle>
          <DialogDescription>{steps[step].title}</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-md"
            >
              {step === 0 && (
                <>
                  <p className="text-muted-foreground text-sm">
                    {t('vaultOnboarding.step1Desc')}
                  </p>
                  <div className="border-warning/30 bg-warning/10 p-sm rounded-lg border">
                    <p className="text-warning text-xs font-medium">
                      {t('vaultOnboarding.step1Warning')}
                    </p>
                    <p className="text-muted-foreground mt-xs text-xs">
                      {t('vaultOnboarding.step1WarningDesc')}
                    </p>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <p className="text-muted-foreground text-sm">
                    {t('vaultOnboarding.step2Desc')}
                  </p>
                  <div className="space-y-xs">
                    <p className="text-xs font-medium">
                      {t('vaultOnboarding.step2TipsTitle')}
                    </p>
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        className="gap-xs text-muted-foreground flex items-center text-xs"
                      >
                        <CheckCircle2 className="text-success h-3 w-3 shrink-0" />
                        {t(`vaultOnboarding.step2Tip${n}`)}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {isLast && (
                <>
                  <p className="text-muted-foreground text-sm">
                    {t('vaultOnboarding.step3Desc')}
                  </p>
                  <div className="gap-sm grid">
                    {shortcuts.map(({ icon: Icon, label, path }) => (
                      <Button
                        key={path}
                        variant="outline"
                        className="justify-start"
                        onClick={() => handleAction(path)}
                      >
                        <Icon />
                        {t(`vaultOnboarding.${label}`)}
                      </Button>
                    ))}
                  </div>
                </>
              )}

              <div className="gap-xs flex justify-center">
                {steps.map((s, i) => (
                  <span
                    key={s.title}
                    className={cn(
                      'h-1.5 rounded-full transition-[width,background-color]',
                      i === step ? 'bg-primary w-6' : 'bg-muted w-1.5'
                    )}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <StepNav
          onBack={() => goTo(step - 1)}
          onNext={() => goTo(step + 1)}
          isFirst={step === 0}
          isLast={isLast}
        />

        <DialogFooter className="gap-sm">
          <Button variant="outline" onClick={handleComplete}>
            <X />
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={handleComplete}>
            <ArrowRight />
            {t('vaultOnboarding.finish')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useVaultOnboarding() {
  return {
    isCompleted: () => localStorage.getItem(STORAGE_KEY) === 'true',
    markCompleted: () => localStorage.setItem(STORAGE_KEY, 'true'),
  };
}
