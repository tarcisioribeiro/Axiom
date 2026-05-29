import { AnimatePresence } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { copyToClipboard } from '@/lib/utils';

export function Toaster() {
  const { toasts } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleCopy = async (
    id: string,
    title?: React.ReactNode,
    description?: React.ReactNode
  ) => {
    const titleText = typeof title === 'string' ? title : '';
    const descriptionText = typeof description === 'string' ? description : '';
    const textToCopy = `${titleText}\n${descriptionText}`.trim();

    try {
      await copyToClipboard(textToCopy);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      logger.error('Failed to copy:', err);
    }
  };

  return (
    <ToastProvider>
      {/* ARIA live region polite para toasts informativos */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {toasts
          .filter(({ variant }) => variant !== 'destructive')
          .map(({ id, title, description }) => (
            <span key={id}>
              {typeof title === 'string' ? title : ''}
              {typeof description === 'string' ? ` ${description}` : ''}
            </span>
          ))}
      </div>
      {/* ARIA live region assertive para toasts destrutivos */}
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {toasts
          .filter(({ variant }) => variant === 'destructive')
          .map(({ id, title, description }) => (
            <span key={id}>
              {typeof title === 'string' ? title : ''}
              {typeof description === 'string' ? ` ${description}` : ''}
            </span>
          ))}
      </div>
      <AnimatePresence>
        {toasts
          .filter((t) => t.open !== false)
          .map(function ({ id, title, description, action, ...props }) {
            const isDestructive = props.variant === 'destructive';
            return (
              <Toast
                key={id}
                {...props}
                role={isDestructive ? 'alert' : 'status'}
                aria-live={isDestructive ? 'assertive' : 'polite'}
              >
                <div className="grid flex-1 gap-xs">
                  {title && <ToastTitle>{title}</ToastTitle>}
                  {description && <ToastDescription>{description}</ToastDescription>}
                </div>
                <div className="flex items-center gap-sm">
                  {(title || description) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleCopy(id, title, description)}
                      aria-label={t('common.actions.copy')}
                    >
                      {copiedId === id ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  )}
                  {action}
                </div>
                <ToastClose aria-label={t('common.actions.close')} />
              </Toast>
            );
          })}
      </AnimatePresence>
      <ToastViewport />
    </ToastProvider>
  );
}
