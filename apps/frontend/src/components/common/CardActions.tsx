import { MoreHorizontal, Pencil, Trash2, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ACTION_COLOR, type ActionColor } from '@/lib/action-colors';
import { cn } from '@/lib/utils';

export interface CardMenuAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  color: ActionColor;
  disabled?: boolean;
  /** Ícone preenchido (ex.: estrela de favorito ativo). */
  filled?: boolean;
}

interface Props {
  onEdit: () => void;
  onDelete: () => void;
  menuActions?: CardMenuAction[];
  /** Chamado ao abrir o menu, para o clique no item não abrir o detalhe do card. */
  onMenuPointerDown?: () => void;
}

/**
 * Ações do rodapé de card (§4): Editar, Excluir e "..." com as demais, só ícones
 * com tooltip e cor própria por ação. O rodapé (border-t, justify-end) é do card.
 */
export function CardActions({
  onEdit,
  onDelete,
  menuActions = [],
  onMenuPointerDown,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onEdit}
        aria-label={t('common.actions.edit')}
      >
        <Pencil className={cn('h-4 w-4', ACTION_COLOR.edit)} aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onDelete}
        aria-label={t('common.actions.delete')}
      >
        <Trash2 className={cn('h-4 w-4', ACTION_COLOR.delete)} aria-hidden="true" />
      </Button>
      {menuActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={t('common.actions.moreOptions')}
            >
              <MoreHorizontal
                className={cn('h-4 w-4', ACTION_COLOR.more)}
                aria-hidden="true"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onPointerDown={onMenuPointerDown}>
            {menuActions.map(
              ({ icon: Icon, label, onClick, color, disabled, filled }) => (
                <DropdownMenuItem key={label} onClick={onClick} disabled={disabled}>
                  <Icon
                    className={cn(
                      'mr-sm h-4 w-4',
                      ACTION_COLOR[color],
                      filled && 'fill-current'
                    )}
                    aria-hidden="true"
                  />
                  {label}
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
