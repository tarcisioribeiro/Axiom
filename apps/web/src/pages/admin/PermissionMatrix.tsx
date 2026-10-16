import { AnimatePresence, motion } from 'framer-motion';
import { ScrollText, Vault } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PaginatedSlide, LIST_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { getAllModuleItems, navModules } from '@/config/nav-config';
import { slideVariants } from '@/lib/animations';
import { cn } from '@/lib/utils';
import type { ScreenCatalogModule, ScreenGrants } from '@/types';
import type { IconComponent } from '@/types/icon';

// Ícones do menu lateral; módulo "intellect" é o "library" do nav
const MODULE_ICONS: Record<string, IconComponent | undefined> = Object.fromEntries(
  navModules.map((m) => [m.id === 'library' ? 'intellect' : m.id, m.icon])
);
const SCREEN_ICONS: Record<string, IconComponent> = Object.fromEntries(
  navModules.flatMap(getAllModuleItems).map((item) => [item.href, item.icon])
);
// Telas fora do menu
const EXTRA_SCREEN_ICONS: Record<string, IconComponent> = {
  'security.vault': Vault,
  'security.activity_logs': ScrollText,
};

interface PermissionMatrixProps {
  catalog: ScreenCatalogModule[];
  value: ScreenGrants;
  onChange: (value: ScreenGrants) => void;
  /** Dentro de modal a navegação não é fixa no rodapé (§2.5). */
  inDialog?: boolean;
}

/** Editor módulo → telas → ações. Sem `view` a tela não tem acesso, então
 * desmarcar "Ver" limpa as demais ações da tela. */
export function PermissionMatrix({
  catalog,
  value,
  onChange,
  inDialog = false,
}: PermissionMatrixProps) {
  const { t } = useTranslation();
  // Direção da troca: módulo à direita entra pela direita (como a paginação)
  const [selected, setSelected] = useState({ key: catalog[0]?.key ?? '', dir: 1 });
  const moduleKey = selected.key;
  const selectModule = (key: string) => {
    const from = catalog.findIndex((m) => m.key === moduleKey);
    const to = catalog.findIndex((m) => m.key === key);
    if (to !== from) setSelected({ key, dir: to > from ? 1 : -1 });
  };
  const module = catalog.find((m) => m.key === moduleKey) ?? catalog[0];
  if (!module) return null;

  const screenLabel = (key: string, fallback: string) =>
    t(`pages.adminPermissions.screens.${key}`, { defaultValue: fallback });

  const toggleAction = (screenKey: string, actions: string[], action: string) => {
    const current = new Set(value[screenKey] ?? []);
    if (current.has(action)) {
      if (action === 'view') current.clear();
      else current.delete(action);
    } else {
      current.add(action).add('view');
    }
    const next = { ...value };
    if (current.size) next[screenKey] = actions.filter((a) => current.has(a));
    else delete next[screenKey];
    onChange(next);
  };

  const moduleFull = module.screens.every(
    (s) => (value[s.key]?.length ?? 0) === s.actions.length
  );
  const toggleModule = () => {
    const next = { ...value };
    for (const s of module.screens) {
      if (moduleFull) delete next[s.key];
      else next[s.key] = [...s.actions];
    }
    onChange(next);
  };

  return (
    <div className="space-y-md">
      <div className="gap-md flex flex-wrap items-center justify-between">
        <div
          role="tablist"
          className="border-border inline-flex rounded-md border p-0.5"
        >
          {catalog.map((m) => {
            const ModuleIcon = MODULE_ICONS[m.key];
            return (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={m.key === module.key}
                onClick={() => selectModule(m.key)}
                className={cn(
                  'px-md py-xs gap-xs flex items-center rounded-sm text-sm font-medium transition-colors',
                  m.key === module.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {ModuleIcon && <ModuleIcon className="h-4 w-4" aria-hidden="true" />}
                {t(`pages.adminPermissions.modules.${m.key}`, {
                  defaultValue: m.label,
                })}
              </button>
            );
          })}
        </div>
        <Label className="gap-sm flex cursor-pointer items-center">
          <Checkbox checked={moduleFull} onCheckedChange={toggleModule} />
          {t('pages.adminPermissions.fullModule')}
        </Label>
      </div>

      <AnimatePresence mode="wait" initial={false} custom={selected.dir}>
        <motion.div
          key={module.key}
          custom={selected.dir}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
          <PaginatedSlide
            items={module.screens}
            pageSize={LIST_PAGE_SIZE}
            pinNav={!inDialog}
            className="space-y-sm"
          >
            {(screens) =>
              screens.map((screen) => {
                const granted = new Set(value[screen.key] ?? []);
                const ScreenIcon =
                  EXTRA_SCREEN_ICONS[screen.key] ??
                  (screen.path ? SCREEN_ICONS[screen.path] : undefined) ??
                  MODULE_ICONS[module.key];
                // 5 cards de 5.5rem cabem na viewport de referência (880 px)
                return (
                  <Card
                    key={screen.key}
                    className="px-lg py-md gap-md flex min-h-[5.5rem] flex-wrap items-center justify-between"
                  >
                    <span className="gap-md flex items-center text-sm font-medium">
                      {ScreenIcon && (
                        <span className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                          <ScreenIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      )}
                      {screenLabel(screen.key, screen.label)}
                    </span>
                    <div className="gap-x-md gap-y-xs flex flex-wrap justify-end">
                      {screen.actions.map((action) => (
                        <Label
                          key={action}
                          className="gap-xs flex cursor-pointer items-center text-xs font-normal"
                        >
                          <Checkbox
                            checked={granted.has(action)}
                            disabled={action !== 'view' && !granted.has('view')}
                            onCheckedChange={() =>
                              toggleAction(screen.key, screen.actions, action)
                            }
                          />
                          {t(`pages.adminPermissions.actions.${action}`, {
                            defaultValue: action,
                          })}
                        </Label>
                      ))}
                    </div>
                  </Card>
                );
              })
            }
          </PaginatedSlide>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
