import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CardActions, type CardMenuAction } from '@/components/common/CardActions';
import { Card } from '@/components/ui/card';

interface Props {
  avatar: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  metric?: React.ReactNode;
  isFavorite: boolean;
  onOpen: () => void;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Demais ações (copiar, compartilhar…), no menu "..." depois de Favoritar. */
  menuActions?: CardMenuAction[];
}

/**
 * Card de grade do cofre (§5): avatar + título + 1 linha + badge, 1 métrica e
 * rodapé Editar/Excluir/"..." (`CardActions`). Clicar fora dos botões abre o detalhe.
 */
export function VaultItemCard({
  avatar,
  title,
  subtitle,
  badge,
  metric,
  isFavorite,
  onOpen,
  onFavorite,
  onEdit,
  onDelete,
  menuActions = [],
}: Props) {
  const { t } = useTranslation();

  return (
    <Card
      role="button"
      tabIndex={0}
      className="flex cursor-pointer flex-col overflow-hidden"
      onClick={(e) => {
        const target = e.target as HTMLElement;
        // Cliques no menu (portal) não estão dentro do card no DOM.
        if (e.currentTarget.contains(target) && !target.closest('button')) onOpen();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="p-md space-y-sm">
        <div className="flex items-center gap-3">
          {avatar}
          <div className="min-w-0 flex-1">
            <p className="truncate leading-tight font-semibold" title={title}>
              {title}
            </p>
            {subtitle && (
              <p className="text-muted-foreground truncate text-xs">{subtitle}</p>
            )}
          </div>
          {badge}
        </div>
        {metric && <div className="text-sm">{metric}</div>}
      </div>

      <div className="px-md pb-sm mt-auto">
        <div className="pt-sm gap-xs flex items-center justify-end border-t">
          <CardActions
            onEdit={onEdit}
            onDelete={onDelete}
            menuActions={[
              {
                icon: Star,
                label: t('common.actions.favorite'),
                onClick: onFavorite,
                color: 'favorite',
                filled: isFavorite,
              },
              ...menuActions,
            ]}
          />
        </div>
      </div>
    </Card>
  );
}
