import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Copy, CheckCircle2, AlertTriangle } from 'lucide-react';

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
import { useToast } from '@/hooks/use-toast';
import { API_CONFIG } from '@/config/api-config';
import { apiClient } from '@/services/api-client';
import { getErrorMessage } from '@/utils/error-utils';

interface VaultRecoveryKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'generate' | 'use';
  onUnlocked?: () => void;
}

export function VaultRecoveryKeyModal({
  open,
  onOpenChange,
  mode,
  onUnlocked,
}: VaultRecoveryKeyModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
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
        title: t('pages.security.recoveryKey.generateError'),
        description: getErrorMessage(e),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedKey) return;
    void navigator.clipboard.writeText(generatedKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleUnlock = async () => {
    if (!recoveryInput.trim()) return;
    setLoading(true);
    try {
      await apiClient.post(API_CONFIG.ENDPOINTS.SECURITY_VAULT_RECOVERY_UNLOCK, {
        recovery_key: recoveryInput.trim(),
      });
      toast({ title: t('pages.security.recoveryKey.unlockSuccess') });
      onOpenChange(false);
      onUnlocked?.();
    } catch (e) {
      toast({
        title: t('pages.security.recoveryKey.unlockError'),
        description: getErrorMessage(e),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setGeneratedKey(null);
    setCopied(false);
    setRecoveryInput('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-sm">
            <Key className="h-4 w-4" />
            {mode === 'generate'
              ? t('pages.security.recoveryKey.generateTitle')
              : t('pages.security.recoveryKey.useTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'generate'
              ? t('pages.security.recoveryKey.generateDesc')
              : t('pages.security.recoveryKey.useDesc')}
          </DialogDescription>
        </DialogHeader>

        {mode === 'generate' ? (
          <div className="space-y-md">
            {!generatedKey ? (
              <>
                <div className="flex items-start gap-sm rounded-lg border border-warning/40 bg-warning/10 p-sm text-sm text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t('pages.security.recoveryKey.generateWarning')}</span>
                </div>
                <Button
                  onClick={() => void handleGenerate()}
                  disabled={loading}
                  className="w-full gap-sm"
                >
                  <Key className="h-4 w-4" />
                  {loading
                    ? t('common.actions.loading')
                    : t('pages.security.recoveryKey.generateBtn')}
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-start gap-sm rounded-lg border border-destructive/40 bg-destructive/10 p-sm text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t('pages.security.recoveryKey.oneTimeWarning')}</span>
                </div>
                <div className="space-y-xs">
                  <Label>{t('pages.security.recoveryKey.yourKey')}</Label>
                  <div className="flex gap-sm">
                    <Input
                      value={generatedKey}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" size="icon" onClick={handleCopy}>
                      {copied ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('pages.security.recoveryKey.saveHint')}
                  </p>
                </div>
                <DialogFooter>
                  <Button onClick={handleClose}>
                    {t('pages.security.recoveryKey.savedConfirm')}
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-md">
            <div className="space-y-xs">
              <Label htmlFor="recovery-input">
                {t('pages.security.recoveryKey.inputLabel')}
              </Label>
              <Input
                id="recovery-input"
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(e.target.value)}
                placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX"
                className="font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleUnlock();
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                {t('common.actions.cancel')}
              </Button>
              <Button
                onClick={() => void handleUnlock()}
                disabled={loading || !recoveryInput.trim()}
              >
                {loading
                  ? t('common.actions.loading')
                  : t('pages.security.recoveryKey.unlockBtn')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
