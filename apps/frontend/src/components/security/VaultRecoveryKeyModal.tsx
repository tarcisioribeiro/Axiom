import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Key,
  KeyRound,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_CONFIG } from '@/config/api-config';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/utils';
import { apiClient } from '@/services/api-client';
import { getErrorMessage } from '@/utils/error-utils';

interface VaultRecoveryKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Gera a chave de recuperação do cofre (modal de ação, §2.4). */
export function VaultRecoveryKeyModal({
  open,
  onOpenChange,
}: VaultRecoveryKeyModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<{ recovery_key: string }>(
        API_CONFIG.ENDPOINTS.SECURITY_VAULT_RECOVERY_KEY_GENERATE,
        {}
      );
      setGeneratedKey(res.recovery_key);
    } catch (e) {
      toast({
        title: t('userProfile.security.recoveryKey.generateError', {
          reason: getErrorMessage(e),
        }),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedKey) return;
    void copyToClipboard(generatedKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setGeneratedKey(null);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle icon={Key}>
            {t('userProfile.security.recoveryKey.generateTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('userProfile.security.recoveryKey.generateDesc')}
          </DialogDescription>
        </DialogHeader>

        {!generatedKey ? (
          <div className="gap-sm border-warning/40 bg-warning/10 p-sm text-warning flex items-start rounded-lg border text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('userProfile.security.recoveryKey.generateWarning')}</span>
          </div>
        ) : (
          <div className="space-y-md">
            <div className="gap-sm border-destructive/40 bg-destructive/10 p-sm text-destructive flex items-start rounded-lg border text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('userProfile.security.recoveryKey.oneTimeWarning')}</span>
            </div>
            <div className="space-y-xs">
              <Label
                className="gap-xs flex items-center"
                htmlFor="generated-recovery-key"
              >
                <KeyRound className="text-muted-foreground h-3.5 w-3.5" />
                {t('userProfile.security.recoveryKey.yourKey')}
              </Label>
              <div className="gap-sm flex">
                <Input
                  id="generated-recovery-key"
                  value={generatedKey}
                  readOnly
                  className="text-sm"
                />
                <Button
                  aria-label={t('common.actions.copy')}
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <CheckCircle2 className="text-success h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {generatedKey ? (
            <Button onClick={handleClose}>
              <Check aria-hidden="true" />
              {t('userProfile.security.recoveryKey.savedConfirm')}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                <X aria-hidden="true" />
                {t('common.actions.cancel')}
              </Button>
              <Button onClick={() => void handleGenerate()} loading={loading}>
                {!loading && <Key aria-hidden="true" />}
                {t('userProfile.security.recoveryKey.generateBtn')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
