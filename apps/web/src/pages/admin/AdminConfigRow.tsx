import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Eye,
  Lock,
  Pencil,
  Save,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/common/LoadingState';
import { Badge } from '@/components/ui/badge';
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
import { PasswordField } from '@/components/user-profile/PasswordSection';
import { useToast } from '@/hooks/use-toast';
import { ACTION_COLOR } from '@/lib/action-colors';
import { cn } from '@/lib/utils';
import { adminService } from '@/services/admin-service';
import type { SystemConfig } from '@/types';

import { VariableHelperPopover } from './AdminConfigVariableHelpers';

export function ConfigRow({
  config,
  onEdit,
  onReveal,
}: {
  config: SystemConfig;
  onEdit: (config: SystemConfig) => void;
  onReveal: (config: SystemConfig) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="border-border gap-md py-sm flex items-center justify-between border-b last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="gap-sm flex flex-wrap items-center">
          <span className="text-foreground font-medium">{config.label}</span>
          <VariableHelperPopover config={config} />
          {config.is_secret && (
            <Badge variant="warning" className="gap-xs">
              <Lock className="h-3 w-3" /> {t('pages.adminConfig.secretBadge')}
            </Badge>
          )}
          {config.requires_restart && (
            <Badge variant="info" className="gap-xs">
              <AlertTriangle className="h-3 w-3" />
              {t('pages.adminConfig.requiresRestartBadge')}
            </Badge>
          )}
        </div>
        <div className="gap-sm mt-0.5 flex min-w-0 items-center text-xs">
          <span className="text-muted-foreground font-mono">{config.key}</span>
          <span className="text-muted-foreground">·</span>
          <span
            className={cn(
              'truncate',
              config.is_configured ? 'text-foreground' : 'text-muted-foreground italic'
            )}
          >
            {!config.is_configured
              ? t('pages.adminConfig.notConfigured')
              : config.is_secret
                ? '••••••••'
                : config.masked_value}
          </span>
          {config.updated_by_username && (
            <span className="text-muted-foreground shrink-0">
              {t('pages.adminConfig.updatedBy', {
                username: config.updated_by_username,
              })}
            </span>
          )}
        </div>
      </div>

      {config.is_secret && config.is_configured && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => onReveal(config)}
          aria-label={t('pages.adminConfig.revealTitle')}
        >
          <Eye className={cn('h-4 w-4', ACTION_COLOR.reveal)} aria-hidden="true" />
        </Button>
      )}

      {config.is_editable && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => onEdit(config)}
          aria-label={t('pages.adminConfig.editTitle')}
        >
          <Pencil className={cn('h-4 w-4', ACTION_COLOR.edit)} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

/** Modal de edição de uma configuração (§2.2): campo + Cancelar/Salvar. */
export function ConfigEditDialog({
  config,
  onClose,
}: {
  config: SystemConfig | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [lastKey, setLastKey] = useState<string>();

  // Recarrega o valor ao abrir para outra configuração (sem useEffect, §2.1).
  if (config && config.key !== lastKey) {
    setLastKey(config.key);
    setValue(config.is_secret ? '' : (config.masked_value ?? ''));
    setInvalid(false);
  }

  const mutation = useMutation({
    mutationFn: (val: string) => adminService.updateConfig(config!.key, val),
    onSuccess: () => {
      toast({
        title: t('pages.adminConfig.configSavedDesc', { label: config!.label }),
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'config'] });
      close();
    },
    onError: (err: Error) => {
      toast({
        title: t('pages.adminConfig.configError', { reason: err.message }),
        variant: 'destructive',
      });
    },
  });

  const close = () => {
    setLastKey(undefined);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === '') {
      setInvalid(true);
      toast({ title: t('pages.adminConfig.emptyValueDesc'), variant: 'destructive' });
      return;
    }
    mutation.mutate(value);
  };

  const onChange = (v: string) => {
    setValue(v);
    setInvalid(false);
  };

  return (
    <Dialog open={!!config} onOpenChange={(o) => !o && close()}>
      <DialogContent size="sm">
        <form noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle mode="edit">{config?.label}</DialogTitle>
            <DialogDescription>{config?.key}</DialogDescription>
          </DialogHeader>

          <div className="py-md">
            {config?.is_secret ? (
              <PasswordField
                id="config-value"
                label={t('pages.adminConfig.valueLabel')}
                value={value}
                onChange={onChange}
                autoComplete="new-password"
                placeholder={t('pages.adminConfig.newSecretPlaceholder')}
                invalid={invalid}
              />
            ) : (
              <FormField
                id="config-value"
                label={t('pages.adminConfig.valueLabel')}
                icon={SlidersHorizontal}
                error={invalid ? t('pages.adminConfig.emptyValueDesc') : undefined}
                hideValidationIcon
              >
                <Input
                  id="config-value"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={t('pages.adminConfig.newValuePlaceholder')}
                  aria-invalid={invalid}
                />
              </FormField>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              <X className="h-4 w-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {!mutation.isPending && <Save className="h-4 w-4" />}
              {t('common.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Modal de detalhe (§2.3) com o valor real de uma configuração secreta. */
export function ConfigRevealDialog({
  config,
  onClose,
}: {
  config: SystemConfig | undefined;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'config', 'reveal', config?.key],
    queryFn: () => adminService.revealConfig(config!.key),
    enabled: !!config,
    // Segredo: não fica em cache depois de fechar o modal.
    gcTime: 0,
    staleTime: 0,
  });

  return (
    <Dialog open={!!config} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle icon={Eye}>{config?.label}</DialogTitle>
          <DialogDescription>{config?.key}</DialogDescription>
        </DialogHeader>

        <div className="py-md">
          {isLoading ? (
            <LoadingState />
          ) : (
            <p className="border-border bg-muted/40 p-sm text-foreground rounded-md border font-mono text-sm break-all select-all">
              {data?.value}
            </p>
          )}
        </div>

        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}
