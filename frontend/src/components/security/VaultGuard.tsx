import { Lock, Shield, Eye, EyeOff, KeyRound, AlertCircle } from 'lucide-react';
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
            Configure uma senha mestre para proteger seus dados sensíveis. Senhas do
            cofre, arquivos, números de conta bancária e CVV de cartões serão
            re-criptografados com essa senha. Ela nunca é armazenada — guarde-a em local
            seguro.
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
// VaultMigrateScreen
// ============================================================================

interface VaultMigrateScreenProps {
  onBack: () => void;
}

function VaultMigrateScreen({ onBack }: VaultMigrateScreenProps) {
  const [oldKey, setOldKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleMigrate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await vaultConfigService.migrateFromBackup({
        old_encryption_key: oldKey.trim(),
      });
      toast({
        title: 'Migração concluída',
        description: result.message,
        variant: 'success',
      });
      onBack();
    } catch (err) {
      toast({
        title: 'Erro na migração',
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
          <div className="mx-auto mb-md flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
            <KeyRound className="h-8 w-8 text-warning" />
          </div>
          <CardTitle className="text-2xl">Migrar Chave de Criptografia</CardTitle>
          <CardDescription>
            Use esta opção ao restaurar um backup de outro ambiente. Informe a chave de
            criptografia original (ENCRYPTION_KEY) para re-criptografar seus dados para
            a chave do cofre atual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-md">
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              O cofre deve estar desbloqueado. Apenas campos criptografados com a chave
              antiga serão migrados — os demais serão ignorados.
            </p>
          </div>
          <form onSubmit={handleMigrate} className="space-y-md">
            <div className="space-y-xs">
              <Label htmlFor="old-key">
                Chave de Criptografia Antiga (ENCRYPTION_KEY)
              </Label>
              <Input
                id="old-key"
                type="text"
                value={oldKey}
                onChange={(e) => setOldKey(e.target.value)}
                placeholder="Ex: nw7c4XyMgeNSD1oTaVpq8GGLYa27a5OFaiWI2ws5mBc="
                required
                minLength={44}
                maxLength={44}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Chave Fernet base64 de 44 caracteres do arquivo <code>.env</code>{' '}
                original.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onBack}
                disabled={isSubmitting}
              >
                Voltar
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? 'Migrando...' : 'Migrar Dados'}
              </Button>
            </div>
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
    return (
      <div>
        <VaultUnlockScreen onSuccess={refresh} />
        <div className="mt-3 text-center">
          <p className="text-xs text-muted-foreground">
            Restaurando de um backup? Desbloqueie o cofre e acesse{' '}
            <a
              href="/security/migrate-encryption"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Migrar chave de criptografia
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  // Vault desbloqueado
  return <>{children}</>;
}

export { VaultMigrateScreen };
