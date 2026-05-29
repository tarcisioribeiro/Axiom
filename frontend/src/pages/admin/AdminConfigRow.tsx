import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  RefreshCw,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/hooks/use-toast';
import { adminService } from '@/services/admin-service';
import type { ConfigCategory, SystemConfig } from '@/types';

import { VariableHelperPopover } from './AdminConfigVariableHelpers';

export function ConfigRow({ config }: { config: SystemConfig }) {
  const { t } = useTranslation();
  const varDescription = t(`pages.adminConfig.variables.${config.key}.description`, {
    defaultValue: config.description ?? '',
  });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (val: string) => adminService.updateConfig(config.key, val),
    onSuccess: () => {
      toast({
        title: t('pages.adminConfig.configSaved'),
        description: t('pages.adminConfig.configSavedDesc', { label: config.label }),
      });
      setEditing(false);
      setValue('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'config'] });
    },
    onError: (err: Error) => {
      toast({
        title: t('pages.adminConfig.configError'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const handleEdit = () => {
    setValue(config.is_secret ? '' : (config.masked_value ?? ''));
    setEditing(true);
  };

  const handleSave = () => {
    if (value === '') {
      toast({
        title: t('pages.adminConfig.emptyValue'),
        description: t('pages.adminConfig.emptyValueDesc'),
        variant: 'destructive',
      });
      return;
    }
    mutation.mutate(value);
  };

  const displayValue = () => {
    if (!config.is_configured)
      return (
        <span className="italic text-muted-foreground">
          {t('pages.adminConfig.notConfigured')}
        </span>
      );
    if (config.is_secret)
      return <span className="text-muted-foreground">••••••••</span>;
    return <span className="font-mono text-sm">{config.masked_value}</span>;
  };

  return (
    <div className="border-b border-border px-md py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-sm">
            <span className="font-medium text-foreground">{config.label}</span>
            <VariableHelperPopover configKey={config.key} />
            {config.is_secret && (
              <span className="inline-flex items-center gap-xs rounded-full bg-amber-500/10 px-sm py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Lock className="h-3 w-3" /> {t('pages.adminConfig.secretBadge')}
              </span>
            )}
            {config.requires_restart && (
              <span className="inline-flex items-center gap-xs rounded-full bg-blue-500/10 px-sm py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                <AlertTriangle className="h-3 w-3" />{' '}
                {t('pages.adminConfig.requiresRestartBadge')}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{config.key}</p>
          {varDescription && (
            <p className="mt-xs text-xs text-muted-foreground">{varDescription}</p>
          )}

          {/* Editing mode */}
          {editing ? (
            <div className="mt-3 flex items-center gap-sm">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type={config.is_secret && !showValue ? 'password' : 'text'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={
                    config.is_secret
                      ? t('pages.adminConfig.newSecretPlaceholder')
                      : t('pages.adminConfig.newValuePlaceholder')
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-sm pr-10 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                />
                {config.is_secret && (
                  <button
                    type="button"
                    onClick={() => setShowValue((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showValue ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={mutation.isPending}
                className="flex items-center gap-xs rounded-lg bg-primary px-3 py-sm text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {mutation.isPending ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {t('pages.adminConfig.save')}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg border border-border p-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="mt-sm flex items-center gap-sm">
              {displayValue()}
              {config.updated_by_username && (
                <span className="text-xs text-muted-foreground">
                  {t('pages.adminConfig.updatedBy', {
                    username: config.updated_by_username,
                  })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Edit button */}
        {!editing && config.is_editable && (
          <button
            onClick={handleEdit}
            className="mt-0.5 flex-shrink-0 rounded-lg p-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t('pages.adminConfig.editTitle')}
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Restart warning shown during editing */}
      {editing && config.requires_restart && (
        <div className="mt-sm flex items-center gap-sm rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-blue-500" />
          <p className="text-xs text-blue-600 dark:text-blue-400">
            {t('pages.adminConfig.restartRequired')}
          </p>
        </div>
      )}
    </div>
  );
}

export function CategorySection({
  category,
  configs,
}: {
  category: ConfigCategory;
  configs: SystemConfig[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-md overflow-hidden rounded-lg border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-md py-3 hover:bg-accent/50"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">
            {t(`pages.adminConfig.categories.${category}`)}
          </span>
          <span className="rounded-full bg-secondary px-sm py-0.5 text-xs text-muted-foreground">
            {configs.length}
          </span>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-border">
          {configs.map((cfg) => (
            <ConfigRow key={cfg.key} config={cfg} />
          ))}
        </div>
      )}
    </div>
  );
}
