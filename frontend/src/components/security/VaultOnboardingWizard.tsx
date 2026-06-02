import {
  CheckCircle2,
  FileArchive,
  Import,
  KeyRound,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

const STEPS = [
  {
    id: 1,
    title: 'Bem-vindo ao Cofre',
    icon: <Lock className="h-10 w-10 text-primary" />,
  },
  {
    id: 2,
    title: 'Configure sua Senha Mestre',
    icon: <KeyRound className="h-10 w-10 text-primary" />,
  },
  {
    id: 3,
    title: 'Primeiros Passos',
    icon: <CheckCircle2 className="text-chart-2 h-10 w-10" />,
  },
];

export function VaultOnboardingWizard({ open, onClose }: Props) {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

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
          <DialogTitle className="flex items-center gap-sm">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Configurar Cofre de Segurança
          </DialogTitle>
        </DialogHeader>

        {/* Stepper indicator */}
        <div className="flex items-center justify-center gap-sm py-sm">
          {STEPS.map((s) => (
            <div key={s.id} className="flex items-center gap-sm">
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
        <div className="flex flex-col items-center gap-md py-md text-center">
          {step === 1 && (
            <>
              <Lock className="h-16 w-16 text-primary" />
              <div className="space-y-xs">
                <h3 className="text-lg font-semibold">
                  Seu cofre de segurança pessoal
                </h3>
                <p className="text-sm text-muted-foreground">
                  O Cofre protege suas senhas, cartões de crédito, contas bancárias e
                  arquivos confidenciais com criptografia de nível militar.
                </p>
              </div>
              <div className="w-full rounded-lg border border-warning/30 bg-warning/10 p-3 text-left">
                <p className="text-xs font-medium text-warning">
                  ⚠️ Atenção importante
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sua senha mestre <strong>não pode ser recuperada</strong>. Guarde-a em
                  local seguro. Se perdida, os dados do cofre são irrecuperáveis.
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <KeyRound className="h-16 w-16 text-primary" />
              <div className="space-y-xs">
                <h3 className="text-lg font-semibold">Configure sua Senha Mestre</h3>
                <p className="text-sm text-muted-foreground">
                  A senha mestre é a chave que protege todo o seu cofre. Use uma senha
                  forte e única que você não use em nenhum outro lugar.
                </p>
              </div>
              <div className="w-full space-y-xs text-left">
                <p className="text-xs font-medium">Dicas para uma senha forte:</p>
                {[
                  'Mínimo 12 caracteres',
                  'Misture letras, números e símbolos',
                  'Evite palavras do dicionário',
                  'Não reutilize senhas de outros serviços',
                ].map((tip) => (
                  <div
                    key={tip}
                    className="flex items-center gap-xs text-xs text-muted-foreground"
                  >
                    <CheckCircle2 className="text-chart-2 h-3 w-3 flex-shrink-0" />
                    {tip}
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={() => handleAction('/security')}>
                Configurar senha mestre agora
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <CheckCircle2 className="text-chart-2 h-16 w-16" />
              <div className="space-y-xs">
                <h3 className="text-lg font-semibold">
                  Cofre configurado! O que fazer agora?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Comece a adicionar suas credenciais para mantê-las seguras.
                </p>
              </div>
              <div className="grid w-full grid-cols-1 gap-sm">
                <Button
                  variant="outline"
                  className="justify-start gap-sm"
                  onClick={() => handleAction('/security/passwords')}
                >
                  <KeyRound className="h-4 w-4" />
                  Adicionar primeira senha
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-sm"
                  onClick={() => handleAction('/security/password-import')}
                >
                  <Import className="h-4 w-4" />
                  Importar senhas de outro app
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-sm"
                  onClick={() => handleAction('/security/health')}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Ver relatório de saúde
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-sm"
                  onClick={() => handleAction('/security/archives')}
                >
                  <FileArchive className="h-4 w-4" />
                  Armazenar arquivo confidencial
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between gap-sm">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Voltar
            </Button>
          ) : (
            <Button variant="ghost" onClick={handleComplete}>
              Pular
            </Button>
          )}
          {step < STEPS.length ? (
            <Button onClick={() => setStep((s) => s + 1)}>Próximo</Button>
          ) : (
            <Button onClick={handleComplete}>Concluir</Button>
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
