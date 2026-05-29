import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
    <Card className="border-warning/40 bg-warning/5">
      <CardHeader>
        <CardTitle className="text-base">{t('pages.twoFactor.backupCodes')}</CardTitle>
        <CardDescription>{t('pages.twoFactor.backupDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative rounded-md border bg-muted p-md font-mono text-sm">
          {visible ? (
            <div className="grid grid-cols-2 gap-sm">
              {codes.map((code, i) => (
                <span key={i} className="tracking-widest">
                  {code}
                </span>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-sm">
              {codes.map((_, i) => (
                <span key={i} className="tracking-widest text-muted-foreground">
                  ••••••••••
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-sm">
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
                <Check className="mr-sm h-4 w-4 text-success" />{' '}
                {t('common.messages.copied')}
              </>
            ) : (
              <>
                <Copy className="mr-sm h-4 w-4" /> {t('pages.twoFactor.copyBackup')}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
