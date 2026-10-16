import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PlainButton } from '@/components/ui/plain-button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { SystemConfig } from '@/types';

import { VARIABLE_HELPERS } from './adminConfigVariableHelpersData';

export function VariableHelperPopover({ config }: { config: SystemConfig }) {
  const { t } = useTranslation();
  const configKey = config.key;
  const helper = VARIABLE_HELPERS[configKey];
  const description = t(`pages.adminConfig.variables.${configKey}.description`, {
    defaultValue: config.description ?? '',
  });
  if (!helper && !description) return null;

  const hint = helper
    ? t(`pages.adminConfig.variables.${configKey}.hint`, { defaultValue: helper.hint })
    : '';
  const warning = helper?.warning
    ? t(`pages.adminConfig.variables.${configKey}.warning`, {
        defaultValue: helper.warning,
      })
    : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <PlainButton
          type="button"
          className="text-muted-foreground/60 hover:text-muted-foreground flex-shrink-0 rounded p-0.5 transition-colors"
          aria-label={t('pages.adminConfig.helpAriaLabel')}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </PlainButton>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="space-y-sm w-80 text-sm">
        {description && <p className="text-foreground leading-snug">{description}</p>}
        {hint && <p className="text-foreground leading-snug">{hint}</p>}

        {helper?.accepted_values && (
          <div>
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t('pages.adminConfig.popover.acceptedValues')}
            </span>
            <p className="text-foreground/80 mt-0.5 text-xs">
              {helper.accepted_values}
            </p>
          </div>
        )}

        {helper?.default_value && (
          <div>
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t('pages.adminConfig.popover.default')}
            </span>
            <p className="text-foreground/80 mt-0.5 text-xs">{helper.default_value}</p>
          </div>
        )}

        {helper?.example && (
          <div>
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t('pages.adminConfig.popover.example')}
            </span>
            <p className="text-foreground/80 mt-0.5 text-xs">{helper.example}</p>
          </div>
        )}

        {warning && (
          <div className="gap-sm px-sm py-sm border-warning/30 bg-warning/10 flex rounded-lg border">
            <AlertTriangle className="text-warning mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <p className="text-warning text-xs leading-snug">{warning}</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
