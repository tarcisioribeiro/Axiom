import { useMutation } from '@tanstack/react-query';
import { Mail, RefreshCw, Send, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { adminService } from '@/services/admin-service';
import type { ServiceCheck, ServiceStatus } from '@/types';

const STATUS_VARIANT: Record<ServiceStatus, BadgeProps['variant']> = {
  healthy: 'success',
  unhealthy: 'destructive',
  warning: 'warning',
  not_configured: 'secondary',
  unknown: 'secondary',
  not_active: 'secondary',
};

function StatusBadge({ check }: { check: ServiceCheck | undefined }) {
  const { t } = useTranslation();
  const s = check?.status ?? 'unknown';
  return (
    <Badge variant={STATUS_VARIANT[s] ?? 'secondary'}>
      {t(`pages.adminIntegrations.status.${s}`)}
    </Badge>
  );
}

interface IntegrationCardProps {
  name: string;
  icon: React.ElementType;
  check: ServiceCheck | undefined;
  loading: boolean;
  onOpen: () => void;
  /** Botões só de ícone do rodapé do card (§4). */
  actions?: React.ReactNode;
}

export function IntegrationCard({
  name,
  icon: Icon,
  check,
  loading,
  onOpen,
  actions,
}: IntegrationCardProps) {
  const { t } = useTranslation();
  const models = check?.models?.length ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) =>
        e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ') && onOpen()
      }
      className="border-border bg-card flex cursor-pointer flex-col rounded-lg border"
    >
      <div className="px-md py-sm space-y-sm flex-1">
        <div className="gap-sm flex items-center justify-between">
          <div className="gap-sm flex min-w-0 items-center">
            <div className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <Icon className="text-primary h-4 w-4" />
            </div>
            <span className="text-foreground truncate font-medium">{name}</span>
          </div>
          {loading ? (
            <RefreshCw className="text-muted-foreground h-4 w-4 animate-spin" />
          ) : (
            <StatusBadge check={check} />
          )}
        </div>
        <p className="text-muted-foreground truncate text-sm" title={check?.message}>
          {loading ? t('pages.adminIntegrations.checking') : (check?.message ?? '—')}
        </p>
        {models > 0 && (
          <p className="text-foreground text-sm font-medium">
            {t('pages.adminIntegrations.modelsCount', { count: models })}
          </p>
        )}
      </div>
      {actions && (
        <div className="border-border gap-xs px-sm py-xs flex justify-end border-t">
          {actions}
        </div>
      )}
    </div>
  );
}

/** Detalhe somente leitura da integração (§2.3). */
export function IntegrationDetailDialog({
  item,
  onClose,
}: {
  item:
    | { name: string; icon: React.ElementType; check: ServiceCheck | undefined }
    | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const models = item?.check?.models ?? [];

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle icon={item?.icon}>{item?.name}</DialogTitle>
          <DialogDescription>{item?.check?.message}</DialogDescription>
        </DialogHeader>
        <div className="space-y-md py-sm">
          <StatusBadge check={item?.check} />
          {item?.check?.message && (
            <p className="text-foreground text-sm break-words">{item.check.message}</p>
          )}
          {models.length > 0 && (
            <div className="space-y-xs">
              <p className="text-muted-foreground text-xs font-medium">
                {t('pages.adminIntegrations.models')}
              </p>
              <div className="gap-xs flex flex-wrap">
                {models.map((m) => (
                  <Badge key={m} variant="outline">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}

/** Modal de ação "Enviar email de teste" (§2.4). */
export function EmailTestDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState(false);
  const { toast } = useToast();

  const close = () => {
    setEmail('');
    setInvalid(false);
    onClose();
  };

  const mutation = useMutation({
    mutationFn: (to: string) => adminService.sendTestEmail(to),
    onSuccess: (data) => {
      toast({ title: data.message });
      close();
    },
    onError: (err: Error) => {
      toast({
        title: t('pages.adminIntegrations.emailError', { reason: err.message }),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setInvalid(true);
      toast({
        title: t('common.fieldRequired', {
          field: t('pages.adminIntegrations.recipient'),
        }),
        variant: 'destructive',
      });
      return;
    }
    mutation.mutate(email);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent size="sm">
        <form noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle icon={Send}>
              {t('pages.adminIntegrations.sendTestEmail')}
            </DialogTitle>
            <DialogDescription>
              {t('pages.adminIntegrations.sendTestEmail')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-md">
            <FormField
              id="test-email"
              label={t('pages.adminIntegrations.recipient')}
              icon={Mail}
              error={invalid ? t('pages.adminIntegrations.recipient') : undefined}
              hideValidationIcon
            >
              <Input
                id="test-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setInvalid(false);
                }}
                placeholder={t('common.placeholders.email')}
                aria-invalid={invalid}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              <X className="h-4 w-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {!mutation.isPending && <Send className="h-4 w-4" />}
              {t('pages.adminIntegrations.sendBtn')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
