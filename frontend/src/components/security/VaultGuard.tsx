import { Lock, Shield, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import { LoadingState } from '@/components/common/LoadingState';
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
import { useVaultStatus } from '@/hooks/use-vault-status';
import { vaultConfigService } from '@/services/security-vault-service';
import { getErrorMessage } from '@/utils/error-utils';

// ============================================================================
// VaultSetupScreen
// ============================================================================

interface VaultSetupScreenProps {
  onSuccess: () => Promise<void>;
}

function VaultSetupScreen({ onSuccess }: VaultSetupScreenProps) {
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPassword !== confirmPassword) {
      toast({
        title: 'Erro',
        description: 'As senhas mestres não coincidem.',
        variant: 'destructive',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await vaultConfigService.setup({
        master_password: masterPassword,
        confirm_master_password: confirmPassword,
      });
      toast({
        title: 'Cofre configurado!',
        description: 'Todos os seus dados foram protegidos com sua senha mestre.',
      });
      await onSuccess();
    } catch (err) {
      toast({
        title: 'Erro ao configurar cofre',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-md flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Proteja seu Cofre</CardTitle>
          <CardDescription>
            Configure uma senha mestre para adicionar uma camada extra de segurança.
            Seus dados serão re-criptografados com essa senha. Ela nunca é armazenada —
            guarde-a em local seguro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetup} className="space-y-md">
            <div className="space-y-xs">
              <Label htmlFor="master-password">Senha Mestre</Label>
              <div className="relative">
                <Input
                  id="master-password"
                  type={showPassword ? 'text' : 'password'}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-xs">
              <Label htmlFor="confirm-password">Confirmar Senha Mestre</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha mestre"
                required
                minLength={8}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Configurando...' : 'Configurar Senha Mestre'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// VaultUnlockScreen
// ============================================================================

interface VaultUnlockScreenProps {
  onSuccess: () => Promise<void>;
}

function VaultUnlockScreen({ onSuccess }: VaultUnlockScreenProps) {
  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await vaultConfigService.unlock({ master_password: masterPassword });
      await onSuccess();
    } catch (err) {
      toast({
        title: 'Cofre não desbloqueado',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-md flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Cofre Bloqueado</CardTitle>
          <CardDescription>
            Digite sua senha mestre para desbloquear o cofre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUnlock} className="space-y-md">
            <div className="space-y-xs">
              <Label htmlFor="unlock-password">Senha Mestre</Label>
              <div className="relative">
                <Input
                  id="unlock-password"
                  type={showPassword ? 'text' : 'password'}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Digite sua senha mestre"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Desbloqueando...' : 'Desbloquear Cofre'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// VaultGuard
// ============================================================================

interface VaultGuardProps {
  children: React.ReactNode;
}

/**
 * Guarda de acesso ao cofre de segurança.
 *
 * - Não configurado → mostra tela de configuração de senha mestre
 * - Configurado, bloqueado → mostra tela de desbloqueio
 * - Desbloqueado → renderiza children
 */
export function VaultGuard({ children }: VaultGuardProps) {
  const { status, isLoading, refresh } = useVaultStatus();

  if (isLoading) {
    return <LoadingState message="Verificando cofre..." />;
  }

  if (!status?.is_configured) {
    return <VaultSetupScreen onSuccess={refresh} />;
  }

  if (!status.is_unlocked) {
    return <VaultUnlockScreen onSuccess={refresh} />;
  }

  return <>{children}</>;
}
