import { CheckCircle2, Compass, Lightbulb, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getTourKey,
  isTourHidden,
  OPEN_TOUR_EVENT,
  setTourHidden,
} from '@/config/page-tour';

const VAULT_WIZARD_KEY = 'vault_onboarding_completed';

const ICONS = [Compass, Lightbulb, Search];

// Tour guiado por tela: aparece sempre ao entrar, exceto se o usuário marcou
// "não mostrar mais". O botão da sidebar reabre via OPEN_TOUR_EVENT.
export function PageTour() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const tourKey = getTourKey(pathname);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(false);

  // Ao trocar de página, reinicia e decide se abre (ajuste de estado no render).
  const [lastPath, setLastPath] = useState<string | null>(null);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setStep(0);
    setDontShow(tourKey ? isTourHidden(tourKey) : false);
    // O assistente de configuração do cofre tem prioridade na primeira visita.
    const vaultWizardPending =
      pathname === '/security/dashboard' &&
      localStorage.getItem(VAULT_WIZARD_KEY) !== 'true';
    setOpen(!!tourKey && !isTourHidden(tourKey) && !vaultWizardPending);
  }

  useEffect(() => {
    const show = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_TOUR_EVENT, show);
    return () => window.removeEventListener(OPEN_TOUR_EVENT, show);
  }, []);

  if (!tourKey) return null;

  const close = () => {
    setTourHidden(tourKey, dontShow);
    setOpen(false);
  };

  const p = `pageTour.pages.${tourKey}`;
  const steps = [
    { title: t(`${p}.title`), desc: t(`${p}.desc`) },
    { title: t('pageTour.tipTitle'), desc: t(`${p}.tip`) },
    { title: t('pageTour.navTitle'), desc: t('pageTour.navDesc') },
  ];
  const Icon = ICONS[step];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center">
            <Compass className="text-primary h-5 w-5" />
            {t('pageTour.dialogTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="gap-sm py-sm flex items-center justify-center">
          {steps.map((_, i) => (
            <div key={i} className="gap-sm flex items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  step === i
                    ? 'bg-primary text-primary-foreground'
                    : step > i
                      ? 'bg-chart-2 text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {step > i ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`h-px w-8 ${step > i ? 'bg-chart-2' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="gap-md py-md flex flex-col items-center text-center">
          <Icon className="text-primary h-16 w-16" />
          <div className="space-y-xs">
            <h3 className="text-lg font-semibold">{steps[step].title}</h3>
            <p className="text-muted-foreground text-sm">{steps[step].desc}</p>
          </div>
        </div>

        <label className="gap-sm text-muted-foreground flex cursor-pointer items-center text-sm">
          <Checkbox
            checked={dontShow}
            onCheckedChange={(c) => setDontShow(c === true)}
          />
          {t('pageTour.dontShowAgain')}
        </label>

        <div className="gap-sm flex justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              {t('pageTour.back')}
            </Button>
          ) : (
            <Button variant="ghost" onClick={close}>
              {t('pageTour.skip')}
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>{t('pageTour.next')}</Button>
          ) : (
            <Button onClick={close}>{t('pageTour.finish')}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
