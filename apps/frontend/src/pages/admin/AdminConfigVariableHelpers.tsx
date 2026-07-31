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
          className="text-muted-foreground/60 hover:text-muted-foreground flex-shrink-0 rounded p-0.5 transition-colors"
          aria-label={t('pages.adminConfig.helpAriaLabel')}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="space-y-sm w-80 text-sm">
        <p className="text-foreground leading-snug">{hint}</p>

        {helper.accepted_values && (
          <div>
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t('pages.adminConfig.popover.acceptedValues')}
            </span>
            <p className="text-foreground/80 mt-0.5 font-mono text-xs">
              {helper.accepted_values}
            </p>
          </div>
        )}

        {helper.default_value && (
          <div>
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t('pages.adminConfig.popover.default')}
            </span>
            <p className="text-foreground/80 mt-0.5 font-mono text-xs">
              {helper.default_value}
            </p>
          </div>
        )}

        {helper.example && (
          <div>
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t('pages.adminConfig.popover.example')}
            </span>
            <p className="text-foreground/80 mt-0.5 font-mono text-xs">
              {helper.example}
            </p>
          </div>
        )}

        {warning && (
          <div className="gap-sm px-sm py-sm flex rounded-lg border border-amber-500/30 bg-amber-500/10">
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
