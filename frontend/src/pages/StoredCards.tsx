import { useState, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { StoredCardForm } from '@/components/security/StoredCardForm';
import { storedCardsService } from '@/services/stored-cards-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { membersService } from '@/services/members-service';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getErrorMessage } from '@/utils/error-utils';
import { translate } from '@/config/constants';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import type {
  StoredCreditCard,
  StoredCreditCardFormData,
  CreditCard,
  Member,
} from '@/types';
import { PageContainer } from '@/components/common/PageContainer';

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
        title: 'Erro ao carregar dados',
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
      title: 'Excluir cartão',
      description:
        'Tem certeza que deseja excluir este cartão armazenado? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await storedCardsService.delete(id);
      toast({
        title: 'Cartão excluído',
        description: 'O cartão foi excluído com sucesso.',
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir',
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
        title: 'Dados revelados',
        description: 'Os dados do cartão foram descriptografados com sucesso.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao revelar dados',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setRevealingId(null);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: `${label} copiado para a área de transferência.`,
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
          title: 'Cartão atualizado',
          description: 'O cartão foi atualizado com sucesso.',
        });
      } else {
        await storedCardsService.create(data);
        toast({
          title: 'Cartão criado',
          description: 'O cartão foi criado com sucesso.',
        });
      }
      setIsDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao salvar',
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
      (card.last_four_digits?.includes(searchTerm))
  );

  const getFinanceCardName = (id?: number) => {
    if (!id) return 'Nenhum';
    const card = creditCards.find((c) => c.id === id);
    return card ? card.name : 'N/A';
  };

  const columns: Column<StoredCreditCard>[] = [
    {
      key: 'name',
      label: 'Nome',
      render: (card) => (
        <div className="flex items-center gap-2">
          <CreditCardIcon className="h-4 w-4" />
          <span className="font-medium">{card.name}</span>
        </div>
      ),
    },
    {
      key: 'cardholder',
      label: 'Titular',
      render: (card) => <span className="text-sm">{card.cardholder_name}</span>,
    },
    {
      key: 'number',
      label: 'Número',
      render: (card) => {
        const revealed = revealedData.get(card.id);
        if (revealed) {
          return (
            <div className="flex items-center gap-2 font-mono text-sm">
              <span>{revealed.number}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(revealed.number, 'Número do cartão')}
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
      label: 'CVV',
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
      label: 'Bandeira',
      render: (card) => <Badge>{translate('cardBrands', card.flag)}</Badge>,
    },
    {
      key: 'expiration',
      label: 'Validade',
      align: 'center',
      render: (card) => (
        <span className="text-sm">
          {String(card.expiration_month).padStart(2, '0')}/{card.expiration_year}
        </span>
      ),
    },
    {
      key: 'finance_card',
      label: 'Cartão Financeiro',
      render: (card) => (
        <Badge variant="outline" className="text-xs">
          {getFinanceCardName(card.finance_card ?? undefined)}
        </Badge>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Cartões Armazenados"
        icon={<CreditCardIcon />}
        action={{
          label: 'Novo Cartão',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex gap-4">
        <Input
          placeholder="Buscar cartões..."
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
          message: 'Nenhum cartão armazenado encontrado.',
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
                  Ocultar
                </>
              ) : (
                <>
                  <Eye className="mr-1 h-3 w-3" />
                  Revelar
                </>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleEdit(card)} aria-label="Editar">
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(card.id)} aria-label="Excluir">
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCard ? 'Editar' : 'Novo'} Cartão Armazenado
            </DialogTitle>
            <DialogDescription>
              {selectedCard
                ? 'Atualize as informações do cartão armazenado'
                : 'Adicione um novo cartão ao cofre seguro'}
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
  );
}
