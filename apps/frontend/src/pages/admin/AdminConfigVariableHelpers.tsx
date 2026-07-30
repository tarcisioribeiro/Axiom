import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { VARIABLE_HELPERS } from './adminConfigVariableHelpersData';

export function VariableHelperPopover({ configKey }: { configKey: string }) {
  const { t } = useTranslation();
  const helper = VARIABLE_HELPERS[configKey];
  if (!helper) return null;

  const hint = t(`pages.adminConfig.variables.${configKey}.hint`, {
    defaultValue: helper.hint,
  });
  const warning = helper.warning
    ? t(`pages.adminConfig.variables.${configKey}.warning`, {
        defaultValue: helper.warning,
      })
    : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex-shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
          aria-label={t('pages.adminConfig.helpAriaLabel')}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-80 space-y-sm text-sm">
        <p className="leading-snug text-foreground">{hint}</p>

        {helper.accepted_values && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('pages.adminConfig.popover.acceptedValues')}
            </span>
            <p className="mt-0.5 font-mono text-xs text-foreground/80">
              {helper.accepted_values}
            </p>
          </div>
        )}

        {helper.default_value && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('pages.adminConfig.popover.default')}
            </span>
            <p className="mt-0.5 font-mono text-xs text-foreground/80">
              {helper.default_value}
            </p>
          </div>
        )}

        {helper.example && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('pages.adminConfig.popover.example')}
            </span>
            <p className="mt-0.5 font-mono text-xs text-foreground/80">
              {helper.example}
            </p>
          </div>
        )}

        {warning && (
          <div className="flex gap-sm rounded-lg border border-amber-500/30 bg-amber-500/10 px-sm py-sm">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
            <p className="text-xs leading-snug text-amber-700 dark:text-amber-400">
              {warning}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
