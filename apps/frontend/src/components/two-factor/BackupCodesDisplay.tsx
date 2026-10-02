import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

export function BackupCodesDisplay({ codes }: { codes: string[] }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-warning/40 bg-warning/5 p-md space-y-3 rounded-lg border">
      <div className="space-y-xs">
        <p className="text-base font-semibold">{t('pages.twoFactor.backupCodes')}</p>
        <p className="text-muted-foreground text-sm">
          {t('pages.twoFactor.backupDesc')}
        </p>
      </div>
      <div className="bg-muted p-md relative rounded-md border font-mono text-sm">
        {visible ? (
          <div className="gap-sm grid grid-cols-2">
            {codes.map((code, i) => (
              <span key={i} className="tracking-widest">
                {code}
              </span>
            ))}
          </div>
        ) : (
          <div className="gap-sm grid grid-cols-2">
            {codes.map((_, i) => (
              <span key={i} className="text-muted-foreground tracking-widest">
                ••••••••••
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="gap-sm flex">
        <Button variant="outline" size="sm" onClick={() => setVisible((v) => !v)}>
          {visible ? (
            <>
              <EyeOff className="mr-sm h-4 w-4" /> {t('common.actions.hide')}
            </>
          ) : (
            <>
              <Eye className="mr-sm h-4 w-4" /> {t('common.actions.reveal')}
            </>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="mr-sm text-success h-4 w-4" />{' '}
              {t('common.messages.copied')}
            </>
          ) : (
            <>
              <Copy className="mr-sm h-4 w-4" /> {t('pages.twoFactor.copyBackup')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
