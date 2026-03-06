import { Copy, Loader2, Share2, Trash2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { copyToClipboard } from '@/lib/utils';
import { credentialShareService } from '@/services/credential-share-service';
import type { CredentialShareToken, Password } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface SharePasswordModalProps {
  password: Password | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TTL_OPTIONS = [
  { value: '1', label: '1 hora' },
  { value: '24', label: '24 horas' },
  { value: '168', label: '7 dias' },
];

const MAX_USES_OPTIONS = [1, 2, 3, 4, 5];

export function SharePasswordModal({
  password,
  open,
  onOpenChange,
}: SharePasswordModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [tokens, setTokens] = useState<CredentialShareToken[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [ttlHours, setTtlHours] = useState('24');
  const [maxUses, setMaxUses] = useState('1');

  const loadTokens = useCallback(async () => {
    if (!password) return;
    setIsLoadingTokens(true);
    try {
      const data = await credentialShareService.getTokens(password.id);
      setTokens(data);
    } catch (error: unknown) {
      toast({
        title: t('pages.sharePassword.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoadingTokens(false);
    }
  }, [password, t, toast]);

  useEffect(() => {
    if (open && password) {
      void loadTokens();
    }
  }, [open, password, loadTokens]);

  const handleCreate = async () => {
    if (!password) return;
    setIsCreating(true);
    try {
      await credentialShareService.createToken(password.id, {
        ttl_hours: parseInt(ttlHours, 10),
        max_uses: parseInt(maxUses, 10),
      });
      toast({
        title: t('pages.sharePassword.created'),
        description: t('pages.sharePassword.createdDesc'),
      });
      void loadTokens();
    } catch (error: unknown) {
      toast({
        title: t('pages.sharePassword.createError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (tokenId: number) => {
    try {
      await credentialShareService.revokeToken(tokenId);
      toast({
        title: t('pages.sharePassword.revoked'),
        description: t('pages.sharePassword.revokedDesc'),
      });
      void loadTokens();
    } catch (error: unknown) {
      toast({
        title: t('pages.sharePassword.revokeError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleCopyLink = async (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    await copyToClipboard(url);
    toast({
      title: t('common.messages.copied'),
      description: t('pages.sharePassword.linkCopied'),
    });
  };

  const getTokenBadge = (token: CredentialShareToken) => {
    if (token.is_revoked)
      return (
        <Badge variant="destructive">{t('pages.sharePassword.statusRevoked')}</Badge>
      );
    if (token.is_expired)
      return (
        <Badge variant="secondary">{t('pages.sharePassword.statusExpired')}</Badge>
      );
    if (token.is_exhausted)
      return (
        <Badge variant="secondary">{t('pages.sharePassword.statusExhausted')}</Badge>
      );
    return (
      <Badge variant="default" className="bg-green-600">
        {t('pages.sharePassword.statusActive')}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {t('pages.sharePassword.title')}
          </DialogTitle>
          <DialogDescription>
            {password?.title} — {t('pages.sharePassword.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Create new token section */}
        <div className="space-y-4 rounded-lg border p-4">
          <p className="text-sm font-medium">{t('pages.sharePassword.newLink')}</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ttl">{t('pages.sharePassword.ttlLabel')}</Label>
              <Select value={ttlHours} onValueChange={setTtlHours}>
                <SelectTrigger id="ttl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TTL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-uses">{t('pages.sharePassword.maxUsesLabel')}</Label>
              <Select value={maxUses} onValueChange={setMaxUses}>
                <SelectTrigger id="max-uses">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAX_USES_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleCreate} disabled={isCreating} className="w-full">
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.actions.saving')}
              </>
            ) : (
              <>
                <Share2 className="mr-2 h-4 w-4" />
                {t('pages.sharePassword.generateBtn')}
              </>
            )}
          </Button>
        </div>

        {/* Existing tokens */}
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {t('pages.sharePassword.existingLinks')}
          </p>

          {isLoadingTokens ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tokens.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t('pages.sharePassword.noLinks')}
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {getTokenBadge(token)}
                      <span className="text-xs text-muted-foreground">
                        {token.use_count}/{token.max_uses}{' '}
                        {t('pages.sharePassword.uses')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('pages.sharePassword.expiresAt')}{' '}
                      {formatDate(token.expires_at, 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="ml-2 flex shrink-0 gap-1">
                    {token.is_token_valid && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyLink(String(token.token))}
                        title={t('pages.sharePassword.copyLink')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                    {!token.is_revoked && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevoke(token.id)}
                        title={t('pages.sharePassword.revokeBtn')}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
