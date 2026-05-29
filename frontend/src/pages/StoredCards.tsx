/* eslint-disable max-lines */
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Copy,
  CreditCard as CreditCardIcon,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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

export default function StoredCards() {
  const [cards, setCards] = useState<StoredCreditCard[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [currentUserMember, setCurrentUserMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<StoredCreditCard | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealedData, setRevealedData] = useState<
    Map<number, { number: string; cvv: string }>
  >(new Map());
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [cardsData, creditCardsData, memberData] = await Promise.all([
        storedCardsService.getAll(),
        creditCardsService.getAll(),
        membersService.getCurrentUserMember(),
      ]);
      setCards(cardsData);
      setCreditCards(creditCardsData);
      setCurrentUserMember(memberData);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

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
      void loadData();
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
      void loadData();
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

  const filteredCards = cards.filter(
    (card) =>
      card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.cardholder_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.last_four_digits?.includes(searchTerm)
  );

  return (
    <VaultGuard>
      <PageContainer>
        <PageHeader title={t('pages.storedCards.title')} icon={<CreditCardIcon />}>
          <Button onClick={handleCreate} className="gap-sm">
            <Plus className="h-4 w-4" />
            {t('pages.storedCards.newBtn')}
          </Button>
        </PageHeader>

        <FilterBar hasActiveFilters={!!searchTerm} onClear={() => setSearchTerm('')}>
          <SearchInput
            placeholder={t('pages.storedCards.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
        </FilterBar>

        {!isLoading && filteredCards.length === 0 ? (
          <EmptyState
            icon={<CreditCardIcon className="h-12 w-12 text-muted-foreground" />}
            message={
              searchTerm
                ? t('pages.storedCards.emptySearch')
                : t('pages.storedCards.emptySearch')
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 xl:grid-cols-3">
            {filteredCards.map((card) => {
              const flagCfg = FLAG_CONFIG[card.flag] ?? DEFAULT_FLAG;
              const revealed = revealedData.get(card.id);

              return (
                <div key={card.id} className="flex flex-col gap-sm">
                  {/* Card face */}
                  <div
                    className={cn(
                      'relative overflow-hidden rounded-2xl p-5',
                      flagCfg.bg
                    )}
                  >
                    {/* Decorative background circles */}
                    <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-foreground/[0.04]" />
                    <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-foreground/[0.03]" />

                    {/* Top row: chip + brand */}
                    <div className="relative flex items-start justify-between">
                      <div className="h-8 w-10 rounded-md border border-warning/60 bg-gradient-to-br from-warning/40 to-warning/20" />
                      <Badge variant="outline" className={flagCfg.badge}>
                        {card.flag_display}
                      </Badge>
                    </div>

                    {/* Card number */}
                    <div className="relative mt-lg flex items-center gap-sm">
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
                    <div className="relative mt-md flex items-end justify-between gap-sm">
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-widest opacity-50">
                          {t('pages.storedCards.columns.holder')}
                        </p>
                        <p className="truncate text-sm font-semibold uppercase tracking-wide">
                          {card.cardholder_name}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-medium uppercase tracking-widest opacity-50">
                          {t('pages.storedCards.columns.expiry')}
                        </p>
                        <p className="font-mono text-sm font-semibold">
                          {String(card.expiration_month).padStart(2, '0')}/
                          {card.expiration_year}
                        </p>
                        {revealed && (
                          <div className="mt-0.5 flex items-center justify-end gap-xs">
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
                  <div className="flex items-center justify-between gap-sm px-xs">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{card.name}</p>
                      {card.finance_card_name && (
                        <p className="truncate text-xs text-muted-foreground">
                          {card.finance_card_name}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
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
                          className="h-3.5 w-3.5 text-destructive"
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
