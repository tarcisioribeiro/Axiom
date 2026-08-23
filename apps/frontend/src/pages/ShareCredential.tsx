import {
  ExclamationTriangleIcon as AlertTriangle,
  CheckCircleIcon as CheckCircle,
  Square2StackIcon as Copy,
  ArrowTopRightOnSquareIcon as ExternalLink,
  KeyIcon as KeyRound,
  ArrowPathIcon as Loader2,
} from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDate } from '@/lib/formatters';
import { copyToClipboard } from '@/lib/utils';
import { credentialShareService } from '@/services/credential-share-service';
import type { SharedCredential } from '@/types';

type PageState = 'loading' | 'success' | 'expired' | 'not_found' | 'error';

export default function ShareCredential() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const [state, setState] = useState<PageState>(() => {
    if (!token) return 'not_found';
    const fk = new URLSearchParams(window.location.hash.slice(1)).get('key');
    return fk ? 'loading' : 'not_found';
  });
  const [credential, setCredential] = useState<SharedCredential | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;

    // The per-token decryption key is embedded in the URL fragment so that
    // browsers never send it to the server in HTTP requests.
    // Format: /share/<uuid>#key=<base64_fernet_key>
    const fragmentKey = new URLSearchParams(window.location.hash.slice(1)).get('key');

    if (!fragmentKey) return; // Initial state already set to 'not_found' via useState initializer

    const redeem = async (tok: string, key: string) => {
      try {
        const data = await credentialShareService.redeemToken(tok, key);
        setCredential(data);
        setState('success');
      } catch (err: unknown) {
        const status =
          err && typeof err === 'object' && 'status' in err
            ? (err as { status: number }).status
            : 0;
        if (status === 410) {
          const msg =
            err && typeof err === 'object' && 'data' in err
              ? String((err as { data: { error?: string } }).data?.error ?? '')
              : '';
          setErrorMessage(msg);
          setState('expired');
        } else if (status === 404) {
          setState('not_found');
        } else {
          setState('error');
        }
      }
    };

    void redeem(token, fragmentKey);
  }, [token]);

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-background p-md flex min-h-screen items-center justify-center">
      <div className="space-y-md w-full max-w-md">
        {/* Header */}
        <div className="text-center">
          <div className="mb-md bg-primary/10 mx-auto flex h-14 w-14 items-center justify-center rounded-full">
            <KeyRound className="text-primary h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">{t('pages.shareCredential.title')}</h1>
          <p className="mt-xs text-muted-foreground text-sm">
            {t('pages.shareCredential.subtitle')}
          </p>
        </div>

        {/* Loading */}
        {state === 'loading' && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </CardContent>
          </Card>
        )}

        {/* Success */}
        {state === 'success' && credential && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{credential.title}</CardTitle>
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="mr-xs h-3 w-3" />
                  {t('pages.shareCredential.valid')}
                </Badge>
              </div>
              <CardDescription>
                {t('pages.shareCredential.expiresAt')}{' '}
                {formatDate(credential.expires_at, 'dd/MM/yyyy HH:mm')}
                {credential.uses_remaining > 0 && (
                  <span className="ml-sm">
                    · {credential.uses_remaining}{' '}
                    {t('pages.shareCredential.usesRemaining')}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-md">
              <div className="space-y-xs">
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  {t('pages.shareCredential.username')}
                </p>
                <div className="gap-sm flex items-center">
                  <code className="bg-muted py-sm flex-1 rounded px-3 text-sm">
                    {credential.username}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(credential.username)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-xs">
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  {t('pages.shareCredential.password')}
                </p>
                <div className="gap-sm flex items-center">
                  <code className="bg-muted py-sm flex-1 rounded px-3 text-sm">
                    {showPassword ? credential.password : '••••••••••••'}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword
                      ? t('common.actions.hide')
                      : t('common.actions.reveal')}
                  </Button>
                  <Button
                    size="sm"
                    variant={copied ? 'default' : 'ghost'}
                    onClick={() => handleCopy(credential.password)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {credential.site && (
                <div className="space-y-xs">
                  <p className="text-muted-foreground text-xs font-medium uppercase">
                    {t('pages.shareCredential.site')}
                  </p>
                  <a
                    href={credential.site}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-xs text-primary flex items-center text-sm hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {credential.site}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Expired / revoked / exhausted (410) */}
        {state === 'expired' && (
          <Card className="border-destructive/50">
            <CardContent className="flex flex-col items-center gap-3 py-10">
              <AlertTriangle className="text-destructive h-10 w-10" />
              <p className="text-center font-semibold">
                {t('pages.shareCredential.expiredTitle')}
              </p>
              <p className="text-muted-foreground text-center text-sm">
                {errorMessage || t('pages.shareCredential.expiredDesc')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Not found (404) */}
        {state === 'not_found' && (
          <Card className="border-destructive/50">
            <CardContent className="flex flex-col items-center gap-3 py-10">
              <AlertTriangle className="text-destructive h-10 w-10" />
              <p className="text-center font-semibold">
                {t('pages.shareCredential.notFoundTitle')}
              </p>
              <p className="text-muted-foreground text-center text-sm">
                {t('pages.shareCredential.notFoundDesc')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Generic error */}
        {state === 'error' && (
          <Card className="border-destructive/50">
            <CardContent className="flex flex-col items-center gap-3 py-10">
              <AlertTriangle className="text-destructive h-10 w-10" />
              <p className="text-center font-semibold">
                {t('pages.shareCredential.errorTitle')}
              </p>
              <p className="text-muted-foreground text-center text-sm">
                {t('pages.shareCredential.errorDesc')}
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-muted-foreground text-center text-xs">
          {t('pages.shareCredential.footer')}
        </p>
      </div>
    </div>
  );
}
