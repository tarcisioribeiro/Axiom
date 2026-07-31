/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  Star,
  CreditCard as CreditCardIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { StoredCardForm } from '@/components/security/StoredCardForm';
import { VaultGuard } from '@/components/security/VaultGuard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn, copyToClipboard } from '@/lib/utils';
import { creditCardsService } from '@/services/credit-cards-service';
import { membersService } from '@/services/members-service';
import { storedCardsService } from '@/services/stored-cards-service';
import type {
  StoredCreditCard,
  StoredCreditCardFormData,
  CreditCard,
  Member,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type FlagConfig = { bg: string; badge: string };

const FLAG_CONFIG: Record<string, FlagConfig> = {
  VSA: {
    bg: 'border-2 border-info/30 bg-gradient-to-br from-info/20 to-info/5',
    badge: 'border-info/30 bg-info/10 text-info',
  },
  MSC: {
    bg: 'border-2 border-destructive/30 bg-gradient-to-br from-destructive/20 to-destructive/5',
    badge: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  ELO: {
    bg: 'border-2 border-warning/30 bg-gradient-to-br from-warning/20 to-warning/5',
    badge: 'border-warning/30 bg-warning/10 text-warning',
  },
  EXP: {
    bg: 'border-2 border-success/30 bg-gradient-to-br from-success/20 to-success/5',
    badge: 'border-success/30 bg-success/10 text-success',
  },
  HCD: {
    bg: 'border-2 border-destructive/30 bg-gradient-to-br from-destructive/20 to-destructive/5',
    badge: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  DIN: {
    bg: 'border-2 border-accent/30 bg-gradient-to-br from-accent/20 to-accent/5',
    badge: 'border-accent/30 bg-accent/10 text-accent',
  },
  OTHER: {
    bg: 'border-2 border-primary/30 bg-gradient-to-br from-primary/20 to-primary/5',
    badge: 'border-primary/30 bg-primary/10 text-primary',
  },
};

const DEFAULT_FLAG: FlagConfig = FLAG_CONFIG.OTHER;

const EMPTY_CARDS: StoredCreditCard[] = [];
const EMPTY_CREDIT_CARDS: CreditCard[] = [];

export default function StoredCards() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<StoredCreditCard | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealedData, setRevealedData] = useState<
    Map<number, { number: string; cvv: string }>
  >(new Map());
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['stored-cards'],
    queryFn: async () => {
      try {
        const [cardsData, creditCardsData, memberData] = await Promise.all([
          storedCardsService.getAll(),
          creditCardsService.getAll(),
          membersService.getCurrentUserMember(),
        ]);
        return {
          cards: cardsData,
          creditCards: creditCardsData,
          currentUserMember: memberData,
        };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        return {
          cards: EMPTY_CARDS,
          creditCards: EMPTY_CREDIT_CARDS,
          currentUserMember: null as Member | null,
        };
      }
    },
  });
  const cards = data?.cards ?? EMPTY_CARDS;
  const creditCards = data?.creditCards ?? EMPTY_CREDIT_CARDS;
  const currentUserMember = data?.currentUserMember ?? null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['stored-cards'] });

  const handleCreate = () => {
    setSelectedCard(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (card: StoredCreditCard) => {
    setSelectedCard(card);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.storedCards.deleteTitle'),
      description: t('pages.storedCards.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await storedCardsService.delete(id);
      toast({
        title: t('pages.storedCards.deleted'),
        description: t('pages.storedCards.deletedDesc'),
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleReveal = async (id: number) => {
    if (revealedData.has(id)) {
      const newMap = new Map(revealedData);
      newMap.delete(id);
      setRevealedData(newMap);
      return;
    }

    try {
      setRevealingId(id);
      const data = await storedCardsService.reveal(id);
      const newMap = new Map(revealedData);
      newMap.set(id, { number: data.card_number, cvv: data.security_code });
      setRevealedData(newMap);
      toast({
        title: t('pages.storedCards.revealed'),
        description: t('pages.storedCards.revealedDesc'),
      });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.revealError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setRevealingId(null);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    await copyToClipboard(text);
    toast({
      title: t('common.messages.copied'),
      description: t('common.messages.copiedDesc', { label }),
    });
  };

  const handleCopyCardNumber = async (id: number) => {
    const revealed = revealedData.get(id);
    try {
      setCopyingId(id);
      const value = revealed?.number ?? (await storedCardsService.copy(id)).card_number;
      await copyToClipboard(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.copyError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setCopyingId(null);
    }
  };

  const handleSubmit = async (data: StoredCreditCardFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedCard) {
        const updateData: Partial<StoredCreditCardFormData> = { ...data };
        if (!updateData.card_number) delete updateData.card_number;
        if (!updateData.security_code) delete updateData.security_code;
        await storedCardsService.update(selectedCard.id, updateData);
        toast({
          title: t('pages.storedCards.updated'),
          description: t('pages.storedCards.updatedDesc'),
        });
      } else {
        await storedCardsService.create(data);
        toast({
          title: t('pages.storedCards.created'),
          description: t('pages.storedCards.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFavorite = async (id: number) => {
    try {
      const updated = await storedCardsService.toggleFavorite(id);
      queryClient.setQueryData<typeof data>(['stored-cards'], (prev) =>
        prev
          ? { ...prev, cards: prev.cards.map((c) => (c.id === id ? updated : c)) }
          : prev
      );
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const filteredCards = cards.filter((card) => {
    if (showFavoritesOnly && !card.is_favorite) return false;
    return (
      card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.cardholder_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.last_four_digits?.includes(searchTerm)
    );
  });

  return (
    <VaultGuard>
      <PageContainer>
        <PageHeader title={t('pages.storedCards.title')} icon={<CreditCardIcon />}>
          <Button onClick={handleCreate} className="gap-sm">
            <Plus className="h-4 w-4" />
            {t('pages.storedCards.newBtn')}
          </Button>
        </PageHeader>

        <FilterBar
          hasActiveFilters={!!searchTerm || showFavoritesOnly}
          onClear={() => {
            setSearchTerm('');
            setShowFavoritesOnly(false);
          }}
        >
          <SearchInput
            placeholder={t('pages.storedCards.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFavoritesOnly((v) => !v)}
            className="gap-xs"
            title={t('common.actions.favorites')}
          >
            <Star className={cn('h-4 w-4', showFavoritesOnly && 'fill-current')} />
            {t('common.actions.favorites')}
          </Button>
        </FilterBar>

        {!isLoading && filteredCards.length === 0 ? (
          <EmptyState
            icon={<CreditCardIcon className="text-muted-foreground h-12 w-12" />}
            message={
              searchTerm
                ? t('pages.storedCards.emptySearch')
                : t('pages.storedCards.emptySearch')
            }
          />
        ) : (
          <div className="gap-lg grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCards.map((card) => {
              const flagCfg = FLAG_CONFIG[card.flag] ?? DEFAULT_FLAG;
              const revealed = revealedData.get(card.id);

              return (
                <div key={card.id} className="gap-sm flex flex-col">
                  {/* Card face */}
                  <div
                    className={cn(
                      'relative overflow-hidden rounded-2xl p-5',
                      flagCfg.bg
                    )}
                  >
                    {/* Decorative background circles */}
                    <div className="bg-foreground/[0.04] absolute -top-8 -right-8 h-28 w-28 rounded-full" />
                    <div className="bg-foreground/[0.03] absolute -right-10 -bottom-10 h-40 w-40 rounded-full" />

                    {/* Top row: chip + brand */}
                    <div className="relative flex items-start justify-between">
                      <div className="border-warning/60 from-warning/40 to-warning/20 h-8 w-10 rounded-md border bg-gradient-to-br" />
                      <Badge variant="outline" className={flagCfg.badge}>
                        {card.flag_display}
                      </Badge>
                    </div>

                    {/* Card number */}
                    <div className="mt-lg gap-sm relative flex items-center">
                      <span className="font-mono text-base tracking-widest">
                        {revealed
                          ? revealed.number
                          : `**** **** **** ${card.last_four_digits || '****'}`}
                      </span>
                      {revealed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                          onClick={() =>
                            handleCopy(
                              revealed.number,
                              t('pages.storedCards.cardNumberLabel')
                            )
                          }
                          aria-label={t('common.actions.copy')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    {/* Bottom row: holder + expiry/cvv */}
                    <div className="mt-md gap-sm relative flex items-end justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium tracking-widest uppercase opacity-50">
                          {t('pages.storedCards.columns.holder')}
                        </p>
                        <p className="truncate text-sm font-semibold tracking-wide uppercase">
                          {card.cardholder_name}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-medium tracking-widest uppercase opacity-50">
                          {t('pages.storedCards.columns.expiry')}
                        </p>
                        <p className="font-mono text-sm font-semibold">
                          {String(card.expiration_month).padStart(2, '0')}/
                          {card.expiration_year}
                        </p>
                        {revealed && (
                          <div className="gap-xs mt-0.5 flex items-center justify-end">
                            <span className="font-mono text-xs opacity-70">
                              CVV: {revealed.cvv}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
                              onClick={() => handleCopy(revealed.cvv, 'CVV')}
                              aria-label={t('common.actions.copy')}
                            >
                              <Copy className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className="gap-sm px-xs flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{card.name}</p>
                      {card.finance_card_name && (
                        <button
                          className="text-primary flex items-center gap-0.5 truncate text-xs hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            void navigate('/finance/credit-cards');
                          }}
                        >
                          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          {card.finance_card_name}
                        </button>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn(
                          'h-8 w-8 p-0',
                          card.is_favorite && 'text-warning'
                        )}
                        onClick={() => void handleToggleFavorite(card.id)}
                        title={t('common.actions.favorite')}
                        aria-label={t('common.actions.favorite')}
                      >
                        <Star
                          className={cn(
                            'h-3.5 w-3.5',
                            card.is_favorite && 'fill-current'
                          )}
                          aria-hidden="true"
                        />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleReveal(card.id)}
                        disabled={revealingId === card.id}
                        title={
                          revealed
                            ? t('common.actions.hide')
                            : t('common.actions.reveal')
                        }
                        aria-label={
                          revealed
                            ? t('common.actions.hide')
                            : t('common.actions.reveal')
                        }
                      >
                        {revealingId === card.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : revealed ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn(
                          'h-8 w-8 p-0',
                          copiedId === card.id && 'text-success'
                        )}
                        onClick={() => void handleCopyCardNumber(card.id)}
                        disabled={copyingId === card.id}
                        title={
                          copiedId === card.id
                            ? t('common.messages.copied')
                            : t('pages.storedCards.copyCardNumber')
                        }
                        aria-label={t('pages.storedCards.copyCardNumber')}
                      >
                        {copyingId === card.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : copiedId === card.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEdit(card)}
                        title={t('common.actions.edit')}
                        aria-label={t('common.actions.edit')}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDelete(card.id)}
                        title={t('common.actions.delete')}
                        aria-label={t('common.actions.delete')}
                      >
                        <Trash2
                          className="text-destructive h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedCard
                  ? t('pages.storedCards.editTitle')
                  : t('pages.storedCards.newTitle')}
              </DialogTitle>
              <DialogDescription>
                {selectedCard
                  ? t('pages.storedCards.editDesc')
                  : t('pages.storedCards.newDesc')}
              </DialogDescription>
            </DialogHeader>
            <StoredCardForm
              card={selectedCard}
              creditCards={creditCards}
              currentMember={currentUserMember}
              onSubmit={handleSubmit}
              onCancel={() => setIsDialogOpen(false)}
              isLoading={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      </PageContainer>
    </VaultGuard>
  );
}
