import { AnimatePresence } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

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

export function Toaster() {
  const { toasts } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (
    id: string,
    title?: React.ReactNode,
    description?: React.ReactNode
  ) => {
    const titleText = typeof title === 'string' ? title : '';
    const descriptionText = typeof description === 'string' ? description : '';
    const textToCopy = `${titleText}\n${descriptionText}`.trim();

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback para contextos não-seguros (HTTP)
        const el = document.createElement('textarea');
        el.value = textToCopy;
        el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <ToastProvider>
      {/* ARIA live region para anunciar notificacoes */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {toasts.map(({ id, title, description }) => (
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
            return (
              <Toast key={id} {...props} role="alert" aria-live="assertive">
                <div className="grid flex-1 gap-1">
                  {title && <ToastTitle>{title}</ToastTitle>}
                  {description && <ToastDescription>{description}</ToastDescription>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {(title || description) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleCopy(id, title, description)}
                      aria-label="Copiar mensagem"
                    >
                      {copiedId === id ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  )}
                  {action}
                  <ToastClose
                    aria-label="Fechar notificacao"
                    className="static translate-y-0 opacity-100"
                  />
                </div>
              </Toast>
            );
          })}
      </AnimatePresence>
      <ToastViewport />
    </ToastProvider>
  );
}
