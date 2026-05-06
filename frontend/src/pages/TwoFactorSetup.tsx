import { useQuery, useMutation } from '@tanstack/react-query';
import { Shield, ShieldOff, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth-service';
import { getErrorMessage } from '@/utils/error-utils';

// ─── Disable 2FA Card ─────────────────────────────────────────────────────────

function DisableTwoFactor({ onDisabled }: { onDisabled: () => void }) {
  const [password, setPassword] = useState('');
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (pw: string) => authService.disableTwoFactor(pw),
    onSuccess: () => {
      toast({ title: '2FA desativado com sucesso.' });
      onDisabled();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao desativar 2FA',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <ShieldOff className="h-5 w-5" />
          Desativar autenticação de dois fatores
        </CardTitle>
        <CardDescription>
          Para desativar o 2FA, confirme sua senha atual.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(password);
          }}
          className="flex gap-3"
        >
          <Input
            type="password"
            placeholder="Senha atual"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="max-w-xs"
          />
          <Button type="submit" variant="destructive" disabled={mutation.isPending}>
            {mutation.isPending ? 'Desativando...' : 'Desativar 2FA'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Backup Codes Display ─────────────────────────────────────────────────────

function BackupCodesDisplay({ codes }: { codes: string[] }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardHeader>
        <CardTitle className="text-base">Códigos de backup</CardTitle>
        <CardDescription>
          Guarde estes códigos em local seguro. Cada código pode ser usado apenas uma
          vez se você perder acesso ao seu aplicativo autenticador.{' '}
          <strong>Esta é a única vez que eles serão exibidos.</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative rounded-md border bg-muted p-4 font-mono text-sm">
          {visible ? (
            <div className="grid grid-cols-2 gap-2">
              {codes.map((code, i) => (
                <span key={i} className="tracking-widest">
                  {code}
                </span>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {codes.map((_, i) => (
                <span key={i} className="tracking-widest text-muted-foreground">
                  ••••••••••
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setVisible((v) => !v)}>
            {visible ? (
              <>
                <EyeOff className="mr-1.5 h-4 w-4" /> Ocultar
              </>
            ) : (
              <>
                <Eye className="mr-1.5 h-4 w-4" /> Revelar
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="mr-1.5 h-4 w-4 text-success" /> Copiado!
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-4 w-4" /> Copiar todos
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Setup 2FA Flow ────────────────────────────────────────────────────────────

function SetupTwoFactor({ onActivated }: { onActivated: () => void }) {
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const { toast } = useToast();

  const {
    data: setupData,
    isLoading: isLoadingSetup,
    error: setupError,
  } = useQuery({
    queryKey: ['2fa', 'setup'],
    queryFn: () => authService.getTwoFactorSetup(),
    staleTime: Infinity,
    retry: false,
  });

  const activateMutation = useMutation({
    mutationFn: (c: string) => authService.activateTwoFactor(c),
    onSuccess: (data) => {
      setBackupCodes(data.backup_codes);
      toast({ title: '2FA ativado com sucesso!' });
      onActivated();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Código inválido',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  if (isLoadingSetup) {
    return (
      <Card>
        <CardContent className="flex h-48 items-center justify-center">
          <span className="text-sm text-muted-foreground">Gerando QR Code...</span>
        </CardContent>
      </Card>
    );
  }

  if (setupError || !setupData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-destructive">
          Erro ao gerar QR Code. Tente novamente.
        </CardContent>
      </Card>
    );
  }

  if (backupCodes.length > 0) {
    return <BackupCodesDisplay codes={backupCodes} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurar autenticação de dois fatores</CardTitle>
        <CardDescription>
          Escaneie o QR code com seu aplicativo autenticador (Google Authenticator,
          Authy, etc.) e confirme com o código gerado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code */}
        <div className="flex flex-col items-center gap-4">
          <img
            src={setupData.qr_code}
            alt="QR Code 2FA"
            className="h-48 w-48 rounded-md border bg-white p-2"
          />
          <div className="w-full max-w-xs space-y-1">
            <p className="text-xs text-muted-foreground">
              Não consegue escanear? Use a chave manual:
            </p>
            <code className="block break-all rounded bg-muted px-3 py-2 text-xs">
              {setupData.manual_entry_key}
            </code>
          </div>
        </div>

        {/* Code confirmation */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            activateMutation.mutate(code);
          }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <Label htmlFor="totp-code">Código de confirmação</Label>
            <Input
              id="totp-code"
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              required
              className="max-w-xs"
            />
          </div>
          <Button
            type="submit"
            disabled={activateMutation.isPending || code.length < 6}
          >
            {activateMutation.isPending ? 'Ativando...' : 'Ativar 2FA'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TwoFactorSetup() {
  const {
    data: statusData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['2fa', 'status'],
    queryFn: () => authService.getTwoFactorStatus(),
    staleTime: 30_000,
  });

  const is2FAActive = statusData?.is_active ?? false;

  return (
    <PageContainer>
      <PageHeader title="Autenticação de dois fatores (2FA)" icon={<Shield />} />

      {isLoading ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center">
            <span className="text-sm text-muted-foreground">Carregando...</span>
          </CardContent>
        </Card>
      ) : is2FAActive ? (
        <div className="space-y-4">
          <Card className="border-success/30 bg-success/5">
            <CardContent className="flex items-center gap-3 py-4">
              <Shield className="h-5 w-5 text-success" />
              <span className="text-sm font-medium">
                Autenticação de dois fatores está ativa na sua conta.
              </span>
            </CardContent>
          </Card>
          <DisableTwoFactor onDisabled={() => void refetch()} />
        </div>
      ) : (
        <SetupTwoFactor onActivated={() => void refetch()} />
      )}
    </PageContainer>
  );
}
