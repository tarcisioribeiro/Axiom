/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Copy,
  CreditCard as CreditCardIcon,
  Plus,
  Search,
  Star,
  Tag,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { BRAND_COLORS, BRAND_ICONS } from '@/components/credit-cards/card-brands';
import { StoredCardDetailModal } from '@/components/security/StoredCardDetailModal';
import { StoredCardForm } from '@/components/security/StoredCardForm';
import { VaultGuard } from '@/components/security/VaultGuard';
import { VaultItemCard } from '@/components/security/VaultItemCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useCurrentScreen, useScreenAccess } from '@/hooks/use-screen-access';
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
import { CARD_FLAGS } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const EMPTY_CARDS: StoredCreditCard[] = [];
const EMPTY_CREDIT_CARDS: CreditCard[] = [];

function StoredCardsContent() {
  const { can } = useCurrentScreen();
  // Vínculo com o cartão de Finanças só para quem tem a tela Cartões
  const canLinkCards = useScreenAccess().can('finance.credit_cards');
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<StoredCreditCard | undefined>();
  const [detailCard, setDetailCard] = useState<StoredCreditCard | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealedData, setRevealedData] = useState<
    Map<number, { number: string; cvv: string }>
  >(new Map());
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [flagFilter, setFlagFilter] = useState('all');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['stored-cards', canLinkCards],
    queryFn: async () => {
      try {
        const [cardsData, creditCardsData, memberData] = await Promise.all([
          storedCardsService.getAll(),
          canLinkCards ? creditCardsService.getAll() : EMPTY_CREDIT_CARDS,
          membersService.getCurrentUserMember(),
        ]);
        return {
          cards: cardsData,
          creditCards: creditCardsData,
          currentUserMember: memberData,
        };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
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
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
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
      });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.revealError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setRevealingId(null);
    }
  };

  // Copia o cartão completo, um campo por linha com rótulo.
  const handleCopyCardDetails = async (card: StoredCreditCard) => {
    try {
      const data = await storedCardsService.copy(card.id);
      const brand =
        card.flag === 'OTHER' ? t('pages.storedCards.otherBrand') : card.flag_display;
      const expiry = `${String(data.expiration_month).padStart(2, '0')}/${data.expiration_year}`;
      await copyToClipboard(
        [
          `${t('common.filterLabels.brand')}: ${brand}`,
          `${t('pages.storedCards.cardNumberLabel')}: ${data.card_number}`,
          `${t('pages.storedCards.columns.holder')}: ${data.cardholder_name}`,
          `${t('pages.storedCards.columns.expiry')}: ${expiry}`,
          `CVV: ${data.security_code}`,
        ].join('\n')
      );
      toast({ title: t('common.messages.copied') });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.copyError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
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
        });
      } else {
        await storedCardsService.create(data);
        toast({
          title: t('pages.storedCards.created'),
        });
      }
      setIsDialogOpen(false);
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
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
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const filteredCards = cards.filter((card) => {
    if (showFavoritesOnly && !card.is_favorite) return false;
    if (flagFilter !== 'all' && card.flag !== flagFilter) return false;
    return (
      card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.cardholder_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.last_four_digits?.includes(searchTerm)
    );
  });

  return (
    <>
      <PageContainer>
        <PageHeader title={t('pages.storedCards.title')} icon={<CreditCardIcon />}>
          {can('add') && (
            <Button onClick={handleCreate} className="gap-sm">
              <Plus className="h-4 w-4" />
              {t('pages.storedCards.newBtn')}
            </Button>
          )}
        </PageHeader>

        <FilterBar
          hasActiveFilters={!!searchTerm || showFavoritesOnly || flagFilter !== 'all'}
          onClear={() => {
            setSearchTerm('');
            setShowFavoritesOnly(false);
            setFlagFilter('all');
          }}
        >
          <FilterField label={t('common.filterLabels.search')} icon={Search}>
            <SearchInput
              placeholder={t('pages.storedCards.searchPlaceholder')}
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="w-52 sm:w-64"
            />
          </FilterField>
          <FilterField label={t('common.filterLabels.brand')} icon={Tag}>
            <Select value={flagFilter} onValueChange={setFlagFilter}>
              <SelectTrigger
                className="w-40"
                aria-label={t('pages.storedCards.allFlags')}
                startIcon={<CreditCardIcon className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.storedCards.allFlags')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.storedCards.allFlags')}</SelectItem>
                {CARD_FLAGS.map((flag) => (
                  <SelectItem key={flag.value} value={flag.value}>
                    {flag.value === 'OTHER'
                      ? t('pages.storedCards.otherBrand')
                      : flag.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFavoritesOnly((v) => !v)}
            className="gap-xs"
          >
            <Star className={cn('h-4 w-4', showFavoritesOnly && 'fill-current')} />
            {t('common.actions.favorites')}
          </Button>
        </FilterBar>

        {!isLoading && filteredCards.length === 0 ? (
          <EmptyState
            icon={<CreditCardIcon className="text-muted-foreground h-12 w-12" />}
            title={t('pages.storedCards.emptySearch')}
          />
        ) : (
          <PaginatedSlide
            key={`${searchTerm}-${flagFilter}-${showFavoritesOnly}`}
            items={filteredCards}
            pageSize={GRID_PAGE_SIZE}
            className="gap-md grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          >
            {(pageItems) =>
              pageItems.map((card) => (
                <VaultItemCard
                  key={card.id}
                  avatar={
                    <div
                      className={cn(
                        'p-xs flex h-10 w-14 shrink-0 items-end justify-end rounded-md bg-gradient-to-br text-[0.55rem] font-bold tracking-wider text-white',
                        BRAND_COLORS[card.flag] ?? 'from-slate-600 to-slate-900'
                      )}
                    >
                      {BRAND_ICONS[card.flag] ?? ''}
                    </div>
                  }
                  title={card.name}
                  subtitle={`•••• ${card.last_four_digits || '••••'} · ${card.cardholder_name}`}
                  badge={
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {card.flag === 'OTHER'
                        ? t('pages.storedCards.otherBrand')
                        : card.flag_display}
                    </Badge>
                  }
                  metric={
                    <span className="gap-xs text-muted-foreground flex items-center text-xs">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('pages.storedCards.columns.expiry')}{' '}
                      <span className="text-foreground font-medium">
                        {String(card.expiration_month).padStart(2, '0')}/
                        {card.expiration_year}
                      </span>
                    </span>
                  }
                  isFavorite={card.is_favorite}
                  onOpen={() => setDetailCard(card)}
                  onFavorite={() => void handleToggleFavorite(card.id)}
                  onEdit={() => handleEdit(card)}
                  onDelete={() => void handleDelete(card.id)}
                  menuActions={[
                    {
                      icon: Copy,
                      label: t('common.actions.copyDetails'),
                      action: 'reveal',
                      onClick: () => void handleCopyCardDetails(card),
                      color: 'copy' as const,
                    },
                  ]}
                />
              ))
            }
          </PaginatedSlide>
        )}

        <StoredCardDetailModal
          card={detailCard}
          revealed={detailCard ? revealedData.get(detailCard.id) : undefined}
          isRevealing={!!detailCard && revealingId === detailCard.id}
          onReveal={(id) => void handleReveal(id)}
          onClose={() => setDetailCard(null)}
        />

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle mode={selectedCard ? 'edit' : 'create'}>
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
    </>
  );
}

// Os dados do cofre só são buscados depois do desbloqueio (o conteúdo monta dentro do guard).
export default function StoredCards() {
  return (
    <VaultGuard>
      <StoredCardsContent />
    </VaultGuard>
  );
}
