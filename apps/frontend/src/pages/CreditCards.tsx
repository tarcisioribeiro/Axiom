/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import type { TFunction } from 'i18next';
import {
  Pencil,
  Trash2,
  CreditCard as CreditCardIcon,
  Calendar,
  SlidersHorizontal,
  CircleDot,
  Tag,
} from 'lucide-react';
import { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { CreditCardDeleteDialog } from '@/components/credit-cards/CreditCardDeleteDialog';
import { CreditCardDetailModal } from '@/components/credit-cards/CreditCardDetailModal';
import { CreditCardForm } from '@/components/credit-cards/CreditCardForm';
import { CreditLimitAdjustDialog } from '@/components/credit-cards/CreditLimitAdjustDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { translate, TRANSLATIONS } from '@/config/constants';
import { TASK_STATUS_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { DURATION } from '@/lib/animations';
import { formatCurrency } from '@/lib/formatters';
import { getCurrentCreditCardBill } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { ValidationError } from '@/services/api-errors';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { useBreadcrumbExtraStore } from '@/stores/breadcrumb-extra-store';
import type { CreditCard, CreditCardFormData, Account, CreditCardBill } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

/** Duas linhas da grade de cards: 4 no tablet (2 colunas), 6 no desktop (3 colunas). */
const DESKTOP_QUERY = '(min-width: 1024px)';

function useCardsPageSize() {
  const [pageSize, setPageSize] = useState(() =>
    window.matchMedia(DESKTOP_QUERY).matches ? 6 : 4
  );

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const handler = (e: MediaQueryListEvent) => setPageSize(e.matches ? 6 : 4);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return pageSize;
}

function UsageArc({ pct, size = 48 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  const color =
    pct >= 90
      ? 'hsl(var(--destructive))'
      : pct >= 70
        ? 'hsl(var(--warning))'
        : 'hsl(var(--success))';
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

const EMPTY_CREDIT_CARDS: CreditCard[] = [];
const EMPTY_ACCOUNTS: Account[] = [];
const EMPTY_BILLS: CreditCardBill[] = [];

function Wrapper({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? (
    <div className="space-y-lg">{children}</div>
  ) : (
    <PageContainer>{children}</PageContainer>
  );
}

/** Rótulos (sem " *") dos campos do formulário, para mensagens de erro da API. */
const CARD_FIELD_LABEL_KEYS: Record<string, string> = {
  name: 'nameLabel',
  on_card_name: 'onCardNameLabel',
  flag: 'flagLabel',
  card_number: 'cardNumberLabel',
  security_code: 'cvvLabel',
  validation_date: 'validationDateLabel',
  credit_limit: 'creditLimitLabel',
  max_limit: 'maxLimitLabel',
  associated_account: 'associatedAccountLabel',
  due_day: 'dueDayLabel',
  billing_due_day: 'dueDayLabel',
  closing_day: 'closingDayLabel',
  interest_rate: 'interestRateLabel',
  annual_fee: 'annualFeeLabel',
  notes: 'notesLabel',
};

/** Junta os erros de validação da API em uma linha, com rótulos traduzidos. */
function formatCardSaveError(error: unknown, t: TFunction): string {
  if (!(error instanceof ValidationError)) return getErrorMessage(error);

  const messages = Object.entries(error.errors).flatMap(([field, fieldMessages]) => {
    const labelKey = CARD_FIELD_LABEL_KEYS[field];
    const label = labelKey
      ? t(`pages.creditCards.form.${labelKey}`).replace(/ \*$/, '')
      : null;
    return fieldMessages.map((message) => {
      if (!label) return message;
      if (message === 'Este campo é obrigatório.') return `Preencha o campo ${label}`;
      return `${label}: ${message}`;
    });
  });

  return messages.length > 0 ? messages.join('; ') : getErrorMessage(error);
}

export default function CreditCards({
  embedded = false,
  onShowBills,
  isCreateOpen,
  onCreateOpenChange,
}: {
  embedded?: boolean;
  /** Leva à aba de faturas filtrada pelo cartão (usado quando há pendências). */
  onShowBills?: (cardId: number) => void;
  /** Controlado pelo pai, que tem o botão "Novo cartão" acima das abas. */
  isCreateOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const cardsPageSize = useCardsPageSize();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const [detailCard, setDetailCard] = useState<CreditCard | undefined>();
  const [editCard, setEditCard] = useState<CreditCard | undefined>();
  const [limitCard, setLimitCard] = useState<CreditCard | undefined>();
  const [deleteState, setDeleteState] = useState<
    { card: CreditCard; pendingBills: CreditCardBill[] } | undefined
  >();
  const [searchTerm, setSearchTerm] = useState('');
  const [flagFilter, setFlagFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const setExtraLabel = useBreadcrumbExtraStore((s) => s.setExtraLabel);
  const isFormOpen = isCreateOpen || !!editCard;

  useEffect(() => {
    setExtraLabel(detailCard?.name ?? editCard?.name ?? null);
    return () => setExtraLabel(null);
  }, [detailCard, editCard, setExtraLabel]);

  const { data: cardsPageData, isLoading } = useQuery({
    queryKey: ['credit-cards'],
    queryFn: async () => {
      try {
        const [cardsData, accountsData, billsData] = await Promise.all([
          creditCardsService.getAll(),
          accountsService.getAll(),
          creditCardBillsService.getAll(),
        ]);
        return { creditCards: cardsData, accounts: accountsData, allBills: billsData };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
          variant: 'destructive',
        });
        return {
          creditCards: [] as CreditCard[],
          accounts: [] as Account[],
          allBills: [] as CreditCardBill[],
        };
      }
    },
  });
  const creditCards = cardsPageData?.creditCards ?? EMPTY_CREDIT_CARDS;
  const accounts = cardsPageData?.accounts ?? EMPTY_ACCOUNTS;
  const allBills = cardsPageData?.allBills ?? EMPTY_BILLS;

  const closeForm = () => {
    onCreateOpenChange(false);
    setEditCard(undefined);
  };

  const handleSubmit = async (data: CreditCardFormData) => {
    try {
      setIsSubmitting(true);
      if (editCard) {
        await creditCardsService.update(editCard.id, data);
        toast({ title: t('pages.creditCards.updated') });
      } else {
        await creditCardsService.create(data);
        toast({ title: t('pages.creditCards.created') });
      }
      closeForm();
      void queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', {
          reason: formatCardSaveError(error, t),
        }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (card: CreditCard) => {
    // Busca fresca: o cache da página pode não refletir um pagamento recente.
    let bills: CreditCardBill[];
    try {
      bills = await creditCardBillsService.getAll({ credit_card: card.id });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
      return;
    }
    const pending = bills.filter((b) => b.status !== 'paid');
    if (pending.length === 0) {
      const confirmed = await showConfirm({
        title: t('pages.creditCards.deleteTitle'),
        description: t('pages.creditCards.deleteDesc'),
        confirmText: t('pages.creditCards.deleteFlow.continue'),
        cancelText: t('common.actions.cancel'),
        variant: 'destructive',
      });
      if (!confirmed) return;
    }
    setDeleteState({ card, pendingBills: pending });
  };

  const getCardNumber = (card: CreditCard) => {
    const masked = card.card_number_masked || '****';
    if (masked === '****' || masked.replace(/\*/g, '') === '') {
      return null;
    }
    const digitsOnly = masked.replace(/[^\d]/g, '');
    if (!digitsOnly || digitsOnly.length < 4) {
      return null;
    }
    return `**** ${digitsOnly.slice(-4)}`;
  };

  if (isLoading) {
    return <LoadingState />;
  }

  const filteredCreditCards = creditCards.filter((card) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (
        !card.name.toLowerCase().includes(q) &&
        !card.on_card_name.toLowerCase().includes(q)
      )
        return false;
    }
    if (flagFilter !== 'all' && card.flag !== flagFilter) return false;
    if (statusFilter !== 'all' && (statusFilter === 'active') !== card.is_active)
      return false;
    return true;
  });

  const hasActiveFilters =
    searchTerm !== '' || flagFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setFlagFilter('all');
    setStatusFilter('all');
  };

  return (
    <Wrapper embedded={embedded}>
      {creditCards.length > 0 && (
        <FilterBar
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
          activeFilters={[
            ...(flagFilter !== 'all'
              ? [
                  {
                    key: 'flag',
                    label: `${t('pages.creditCards.form.flagLabel')}: ${translate('cardBrands', flagFilter)}`,
                    onRemove: () => setFlagFilter('all'),
                  },
                ]
              : []),
            ...(statusFilter !== 'all'
              ? [
                  {
                    key: 'status',
                    label: `${t('common.fields.status')}: ${statusFilter === 'active' ? t('common.status.active') : t('common.status.inactive')}`,
                    onRemove: () => setStatusFilter('all'),
                  },
                ]
              : []),
          ]}
        >
          <FilterField label={t('common.filterLabels.search')}>
            <SearchInput
              placeholder={t('pages.creditCards.searchPlaceholder')}
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="w-44"
            />
          </FilterField>
          <FilterField label={t('common.filterLabels.brand')}>
            <Select value={flagFilter} onValueChange={setFlagFilter}>
              <SelectTrigger
                className="w-40"
                aria-label={t('pages.creditCards.form.flagLabel')}
                startIcon={<Tag className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.creditCards.allFlags')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.creditCards.allFlags')}</SelectItem>
                {Object.entries(TRANSLATIONS.cardBrands).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label={t('common.fields.status')}>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                className="w-36"
                aria-label={t('pages.creditCards.allStatus')}
                startIcon={<CircleDot className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.creditCards.allStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.creditCards.allStatus')}</SelectItem>
                <SelectItem
                  value="active"
                  icon={<TASK_STATUS_ICONS.active className="h-4 w-4" />}
                >
                  {t('common.status.active')}
                </SelectItem>
                <SelectItem
                  value="inactive"
                  icon={<TASK_STATUS_ICONS.inactive className="h-4 w-4" />}
                >
                  {t('common.status.inactive')}
                </SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
        </FilterBar>
      )}

      {creditCards.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon className="text-muted-foreground h-12 w-12" />}
          title={t('pages.creditCards.emptyTitle')}
        />
      ) : filteredCreditCards.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon className="text-muted-foreground h-12 w-12" />}
          title={t('pages.creditCards.emptyTitle')}
        />
      ) : (
        <PaginatedSlide
          items={filteredCreditCards}
          pageSize={cardsPageSize}
          className="gap-md grid md:grid-cols-2 lg:grid-cols-3"
        >
          {(pageItems) =>
            pageItems.map((card) => {
              const cardNumber = getCardNumber(card);
              const limit = parseFloat(card.credit_limit);
              const available = card.available_credit ?? 0;
              const used = Math.max(0, limit - available);
              const usagePct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

              const openBill = getCurrentCreditCardBill(
                allBills.filter((b) => b.credit_card === card.id)
              );
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const daysUntilDue = openBill?.due_date
                ? Math.ceil(
                    (new Date(openBill.due_date).getTime() - today.getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                : null;
              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: DURATION.fast,
                    delay: creditCards.indexOf(card) * 0.05,
                  }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setDetailCard(card)}
                  className="cursor-pointer"
                >
                  <Card className="overflow-hidden">
                    <div className="px-md pb-lg pt-md relative">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-muted-foreground text-xs">
                            {t('pages.creditCards.stats.availableCredit')}
                          </p>
                          <p className="text-xl font-bold">
                            {formatCurrency(available)}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {t('pages.creditCards.ofLimit', {
                              value: formatCurrency(limit),
                            })}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {t('pages.creditCards.maxLimitValue', {
                              value: formatCurrency(card.max_limit),
                            })}
                          </p>
                        </div>
                        <div className="gap-xs flex items-center">
                          <UsageArc pct={usagePct} size={48} />
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLimitCard(card);
                              }}
                              title={t('pages.creditCards.adjustLimit.title')}
                              aria-label={t('pages.creditCards.adjustLimit.title')}
                            >
                              <SlidersHorizontal
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditCard(card);
                              }}
                              title={t('common.actions.edit')}
                              aria-label={t('common.actions.edit')}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDelete(card);
                              }}
                              title={t('common.actions.delete')}
                              aria-label={t('common.actions.delete')}
                            >
                              <Trash2
                                className="text-destructive h-4 w-4"
                                aria-hidden="true"
                              />
                            </Button>
                          </div>
                        </div>
                      </div>
                      {/* Card chip */}
                      <div className="left-md bg-warning/40 ring-warning/30 absolute bottom-3 h-5 w-7 rounded ring-1" />
                      {/* Bottom accent strip */}
                      <div className="via-primary/40 absolute right-0 bottom-0 left-0 h-px bg-gradient-to-r from-transparent to-transparent" />
                    </div>

                    <CardContent className="space-y-sm pt-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <button
                            className="cursor-pointer text-left font-semibold hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {card.name}
                          </button>
                          {cardNumber && (
                            <p className="text-muted-foreground text-xs">
                              {cardNumber}
                            </p>
                          )}
                          {openBill && (
                            <p
                              className={cn(
                                'mt-0.5 text-xs font-medium',
                                daysUntilDue !== null && daysUntilDue <= 5
                                  ? 'text-destructive'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {t('pages.creditCards.billAmount', {
                                amount: formatCurrency(openBill.total_amount),
                              })}
                              {openBill.due_date &&
                                ` • ${t('pages.creditCards.dueDayText', { day: new Date(openBill.due_date).getUTCDate() })}`}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary">
                          {translate('cardBrands', card.flag)}
                        </Badge>
                      </div>

                      <div className="pt-sm flex items-center justify-between border-t text-sm">
                        <div className="gap-xs text-muted-foreground flex items-center">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{t('pages.creditCards.dueDay')}</span>
                        </div>
                        <span className="font-medium">
                          {t('pages.creditCards.dueDayValue', { day: card.due_day })}
                        </span>
                      </div>

                      {card.associated_account_name && (
                        <p className="text-muted-foreground text-xs">
                          {t('pages.creditCards.associatedAccount')}{' '}
                          {card.associated_account_name}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          }
        </PaginatedSlide>
      )}

      <CreditLimitAdjustDialog
        key={limitCard?.id}
        card={limitCard}
        onOpenChange={(open) => !open && setLimitCard(undefined)}
      />

      <Dialog open={isFormOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle mode={editCard ? 'edit' : 'create'}>
              {editCard
                ? t('pages.creditCards.editTitle')
                : t('pages.creditCards.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {editCard
                  ? t('pages.creditCards.editDesc')
                  : t('pages.creditCards.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <CreditCardForm
            key={editCard?.id ?? 'create'}
            creditCard={editCard}
            accounts={accounts}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <CreditCardDetailModal
        card={detailCard ?? null}
        onClose={() => setDetailCard(undefined)}
      />

      <CreditCardDeleteDialog
        card={deleteState?.card}
        pendingBills={deleteState?.pendingBills ?? EMPTY_BILLS}
        onClose={() => setDeleteState(undefined)}
        onDeleted={() => {
          void queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
        }}
        onShowBills={onShowBills}
      />
    </Wrapper>
  );
}
