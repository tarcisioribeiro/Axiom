import {
  CheckCircle2,
  FileArchive,
  Import,
  KeyRound,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STORAGE_KEY = 'vault_onboarding_completed';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function VaultOnboardingWizard({ open, onClose }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const STEPS = [
    { id: 1, icon: <Lock className="text-primary h-10 w-10" /> },
    { id: 2, icon: <KeyRound className="text-primary h-10 w-10" /> },
    { id: 3, icon: <CheckCircle2 className="text-chart-2 h-10 w-10" /> },
  ];

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onClose();
  };

  const handleAction = (path: string) => {
    handleComplete();
    void navigate(path);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleComplete();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center">
            <ShieldCheck className="text-primary h-5 w-5" />
            {t('vaultOnboarding.dialogTitle')}
          </DialogTitle>
        </DialogHeader>

        {/* Stepper indicator */}
        <div className="gap-sm py-sm flex items-center justify-center">
          {STEPS.map((s) => (
            <div key={s.id} className="gap-sm flex items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  step === s.id
                    ? 'bg-primary text-primary-foreground'
                    : step > s.id
                      ? 'bg-chart-2 text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {step > s.id ? <CheckCircle2 className="h-4 w-4" /> : s.id}
              </div>
              {s.id < STEPS.length && (
                <div
                  className={`h-px w-8 ${step > s.id ? 'bg-chart-2' : 'bg-muted'}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="gap-md py-md flex flex-col items-center text-center">
          {step === 1 && (
            <>
              <Lock className="text-primary h-16 w-16" />
              <div className="space-y-xs">
                <h3 className="text-lg font-semibold">
                  {t('vaultOnboarding.step1Title')}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t('vaultOnboarding.step1Desc')}
                </p>
              </div>
              <div className="border-warning/30 bg-warning/10 w-full rounded-lg border p-3 text-left">
                <p className="text-warning text-xs font-medium">
                  {t('vaultOnboarding.step1Warning')}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t('vaultOnboarding.step1WarningDesc')}
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <KeyRound className="text-primary h-16 w-16" />
              <div className="space-y-xs">
                <h3 className="text-lg font-semibold">
                  {t('vaultOnboarding.step2Title')}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t('vaultOnboarding.step2Desc')}
                </p>
              </div>
              <div className="space-y-xs w-full text-left">
                <p className="text-xs font-medium">
                  {t('vaultOnboarding.step2TipsTitle')}
                </p>
                {[
                  t('vaultOnboarding.step2Tip1'),
                  t('vaultOnboarding.step2Tip2'),
                  t('vaultOnboarding.step2Tip3'),
                  t('vaultOnboarding.step2Tip4'),
                ].map((tip) => (
                  <div
                    key={tip}
                    className="gap-xs text-muted-foreground flex items-center text-xs"
                  >
                    <CheckCircle2 className="text-chart-2 h-3 w-3 flex-shrink-0" />
                    {tip}
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={() => handleAction('/security')}>
                {t('vaultOnboarding.step2ConfigureBtn')}
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <CheckCircle2 className="text-chart-2 h-16 w-16" />
              <div className="space-y-xs">
                <h3 className="text-lg font-semibold">
                  {t('vaultOnboarding.step3Title')}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t('vaultOnboarding.step3Desc')}
                </p>
              </div>
              <div className="gap-sm grid w-full grid-cols-1">
                <Button
                  variant="outline"
                  className="gap-sm justify-start"
                  onClick={() => handleAction('/security/passwords')}
                >
                  <KeyRound className="h-4 w-4" />
                  {t('vaultOnboarding.step3AddPassword')}
                </Button>
                <Button
                  variant="outline"
                  className="gap-sm justify-start"
                  onClick={() => handleAction('/security/password-import')}
                >
                  <Import className="h-4 w-4" />
                  {t('vaultOnboarding.step3ImportPasswords')}
                </Button>
                <Button
                  variant="outline"
                  className="gap-sm justify-start"
                  onClick={() => handleAction('/security/health')}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {t('vaultOnboarding.step3HealthReport')}
                </Button>
                <Button
                  variant="outline"
                  className="gap-sm justify-start"
                  onClick={() => handleAction('/security/archives')}
                >
                  <FileArchive className="h-4 w-4" />
                  {t('vaultOnboarding.step3StoreArchive')}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="gap-sm flex justify-between">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              {t('vaultOnboarding.back')}
            </Button>
          ) : (
            <Button variant="ghost" onClick={handleComplete}>
              {t('vaultOnboarding.skip')}
            </Button>
          )}
          {step < STEPS.length ? (
            <Button onClick={() => setStep((s) => s + 1)}>
              {t('vaultOnboarding.next')}
            </Button>
          ) : (
            <Button onClick={handleComplete}>{t('vaultOnboarding.finish')}</Button>
          )}
        </div>
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
