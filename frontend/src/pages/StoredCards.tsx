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

import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
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
import { Input } from '@/components/ui/input';
import { translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/utils';
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
      // Ocultar dados
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
        // Remove campos vazios (não atualizar dados sensíveis vazios)
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

  const getFinanceCardName = (id?: number) => {
    if (!id) return t('pages.storedCards.noFinanceCard');
    const card = creditCards.find((c) => c.id === id);
    return card ? card.name : 'N/A';
  };

  const columns: Column<StoredCreditCard>[] = [
    {
      key: 'name',
      label: t('pages.storedCards.columns.name'),
      render: (card) => (
        <div className="flex items-center gap-2">
          <CreditCardIcon className="h-4 w-4" />
          <span className="font-medium">{card.name}</span>
        </div>
      ),
    },
    {
      key: 'cardholder',
      label: t('pages.storedCards.columns.holder'),
      render: (card) => <span className="text-sm">{card.cardholder_name}</span>,
    },
    {
      key: 'number',
      label: t('pages.storedCards.columns.number'),
      render: (card) => {
        const revealed = revealedData.get(card.id);
        if (revealed) {
          return (
            <div className="flex items-center gap-2 font-mono text-sm">
              <span>{revealed.number}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  handleCopy(revealed.number, t('pages.storedCards.cardNumberLabel'))
                }
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          );
        }
        return (
          <span className="font-mono text-sm">
            **** **** **** {card.last_four_digits || '****'}
          </span>
        );
      },
    },
    {
      key: 'cvv',
      label: t('pages.storedCards.columns.cvv'),
      align: 'center',
      render: (card) => {
        const revealed = revealedData.get(card.id);
        if (revealed) {
          return (
            <div className="flex items-center justify-center gap-2 font-mono text-sm">
              <span>{revealed.cvv}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(revealed.cvv, 'CVV')}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          );
        }
        return <span>***</span>;
      },
    },
    {
      key: 'flag',
      label: t('pages.storedCards.columns.brand'),
      render: (card) => <Badge>{translate('cardBrands', card.flag)}</Badge>,
    },
    {
      key: 'expiration',
      label: t('pages.storedCards.columns.expiry'),
      align: 'center',
      render: (card) => (
        <span className="text-sm">
          {String(card.expiration_month).padStart(2, '0')}/{card.expiration_year}
        </span>
      ),
    },
    {
      key: 'finance_card',
      label: t('pages.storedCards.columns.isFinancial'),
      render: (card) => (
        <Badge variant="outline" className="text-xs">
          {getFinanceCardName(card.finance_card ?? undefined)}
        </Badge>
      ),
    },
  ];

  return (
    <VaultGuard>
      <PageContainer>
        <PageHeader
          title={t('pages.storedCards.title')}
          icon={<CreditCardIcon />}
          action={{
            label: t('pages.storedCards.newBtn'),
            icon: <Plus className="h-4 w-4" />,
            onClick: handleCreate,
          }}
        />

        <div className="flex gap-4">
          <Input
            placeholder={t('pages.storedCards.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <DataTable
          data={filteredCards}
          columns={columns}
          keyExtractor={(card) => card.id}
          isLoading={isLoading}
          emptyState={{
            message: t('pages.storedCards.emptySearch'),
          }}
          actions={(card) => (
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReveal(card.id)}
                disabled={revealingId === card.id}
              >
                {revealingId === card.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : revealedData.has(card.id) ? (
                  <>
                    <EyeOff className="mr-1 h-3 w-3" />
                    {t('common.actions.hide')}
                  </>
                ) : (
                  <>
                    <Eye className="mr-1 h-3 w-3" />
                    {t('common.actions.reveal')}
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEdit(card)}
                aria-label={t('common.actions.edit')}
                title={t('common.actions.edit')}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(card.id)}
                aria-label={t('common.actions.delete')}
                title={t('common.actions.delete')}
              >
                <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
              </Button>
            </div>
          )}
        />

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
