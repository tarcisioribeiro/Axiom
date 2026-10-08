/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Banknote,
  CircleDot,
  CreditCard,
  Loader2,
  MoreHorizontal,
  Plus,
  QrCode,
  Receipt,
  Save,
  Trash2,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusToggle } from '@/components/ui/status-toggle';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { EXPENSE_CATEGORIES_CANONICAL, translate } from '@/config/constants';
import { EXPENSE_CATEGORY_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { accountsService } from '@/services/accounts-service';
import { automationRulesService } from '@/services/automation-rules-service';
import { tagsService } from '@/services/tags-service';
import type {
  Account,
  AutomationAction,
  AutomationActionType,
  AutomationCondition,
  AutomationConditionField,
  AutomationOperator,
  AutomationRule,
  AutomationRuleFormData,
  Tag,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const CONDITION_FIELDS: AutomationConditionField[] = [
  'merchant',
  'description',
  'category',
  'value',
  'account',
  'payment_method',
];

const OPERATORS_BY_FIELD: Record<AutomationConditionField, AutomationOperator[]> = {
  merchant: ['contains', 'eq'],
  description: ['contains', 'eq'],
  category: ['contains'],
  payment_method: ['contains'],
  account: ['contains'],
  value: ['eq', 'gt', 'lt', 'gte', 'lte'],
};

const ACTION_TYPES: AutomationActionType[] = [
  'set_category',
  'add_tag',
  'create_alert',
];

const PAYMENT_METHODS = [
  'cash',
  'debit_card',
  'credit_card',
  'pix',
  'transfer',
  'check',
  'other',
];

const PAYMENT_METHOD_ICONS: Record<string, LucideIcon> = {
  cash: Banknote,
  debit_card: Wallet,
  credit_card: CreditCard,
  pix: QrCode,
  transfer: ArrowLeftRight,
  check: Receipt,
  other: MoreHorizontal,
};

function ConditionRow({
  condition,
  index,
  accounts,
  onChange,
  onRemove,
}: {
  condition: AutomationCondition;
  index: number;
  accounts: Account[];
  onChange: (i: number, c: AutomationCondition) => void;
  onRemove: (i: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="gap-sm border-border/60 bg-muted/20 p-sm grid grid-cols-[1fr_1fr_1fr_auto] rounded-lg border">
      <Select
        value={condition.field}
        onValueChange={(v) => {
          const field = v as AutomationConditionField;
          const allowedOps = OPERATORS_BY_FIELD[field];
          const operator = allowedOps.includes(condition.operator)
            ? condition.operator
            : allowedOps[0];
          onChange(index, { ...condition, field, operator });
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={t('pages.automationRules.conditionField')} />
        </SelectTrigger>
        <SelectContent>
          {CONDITION_FIELDS.map((f) => (
            <SelectItem key={f} value={f}>
              {t(`pages.automationRules.fields.${f}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={condition.operator}
        onValueChange={(v) =>
          onChange(index, { ...condition, operator: v as AutomationOperator })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder={t('pages.automationRules.conditionOperator')} />
        </SelectTrigger>
        <SelectContent>
          {OPERATORS_BY_FIELD[condition.field].map((op) => (
            <SelectItem key={op} value={op}>
              {t(`pages.automationRules.operators.${op}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {condition.field === 'category' ? (
        <Select
          value={condition.value}
          onValueChange={(v) => onChange(index, { ...condition, value: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('pages.automationRules.conditionValue')} />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_CATEGORIES_CANONICAL.map((cat) => {
              const CatIcon = EXPENSE_CATEGORY_ICONS[cat.key];
              return (
                <SelectItem key={cat.key} value={cat.key}>
                  <span className="gap-sm flex items-center">
                    {CatIcon && (
                      <CatIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                    )}
                    {translate('expenseCategories', cat.key)}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      ) : condition.field === 'payment_method' ? (
        <Select
          value={condition.value}
          onValueChange={(v) => onChange(index, { ...condition, value: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('pages.automationRules.conditionValue')} />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((pm) => {
              const PmIcon = PAYMENT_METHOD_ICONS[pm];
              return (
                <SelectItem key={pm} value={pm}>
                  <span className="gap-sm flex items-center">
                    {PmIcon && <PmIcon className="h-4 w-4" />}
                    {t(`common.paymentMethods.${pm}`)}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      ) : condition.field === 'account' ? (
        <Select
          value={condition.value}
          onValueChange={(v) => onChange(index, { ...condition, value: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('pages.automationRules.conditionValue')} />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={String(acc.id)}>
                {acc.account_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : condition.field === 'value' ? (
        <CurrencyInput
          value={condition.value}
          onChange={(e) => onChange(index, { ...condition, value: e.target.value })}
        />
      ) : (
        <Input
          placeholder={t('pages.automationRules.conditionValue')}
          value={condition.value}
          onChange={(e) => onChange(index, { ...condition, value: e.target.value })}
        />
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive h-8 w-8"
        onClick={() => onRemove(index)}
        title={t('pages.automationRules.removeCondition')}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ActionRow({
  action,
  index,
  tags,
  onChange,
  onRemove,
}: {
  action: AutomationAction;
  index: number;
  tags: Tag[];
  onChange: (i: number, a: AutomationAction) => void;
  onRemove: (i: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="gap-sm border-border/60 bg-muted/20 p-sm grid grid-cols-[1fr_1fr_auto] rounded-lg border">
      <Select
        value={action.type}
        onValueChange={(v) =>
          onChange(index, { ...action, type: v as AutomationActionType })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder={t('pages.automationRules.actionType')} />
        </SelectTrigger>
        <SelectContent>
          {ACTION_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {t(`pages.automationRules.actionTypes.${type}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {action.type === 'set_category' ? (
        <Select
          value={action.value}
          onValueChange={(v) => onChange(index, { ...action, value: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('pages.automationRules.actionValue')} />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_CATEGORIES_CANONICAL.map((cat) => {
              const CatIcon = EXPENSE_CATEGORY_ICONS[cat.key];
              return (
                <SelectItem key={cat.key} value={cat.key}>
                  <span className="gap-sm flex items-center">
                    {CatIcon && (
                      <CatIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                    )}
                    {translate('expenseCategories', cat.key)}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      ) : action.type === 'add_tag' ? (
        <Select
          value={action.value}
          onValueChange={(v) => onChange(index, { ...action, value: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('pages.automationRules.actionValue')} />
          </SelectTrigger>
          <SelectContent>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={String(tag.id)}>
                <span className="gap-sm flex items-center">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: `hsl(var(--${tag.color}))` }}
                  />
                  {tag.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          placeholder={t('pages.automationRules.actionValue')}
          value={action.value}
          onChange={(e) => onChange(index, { ...action, value: e.target.value })}
        />
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive h-8 w-8"
        onClick={() => onRemove(index)}
        title={t('pages.automationRules.removeAction')}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function RuleFormDialog({
  rule,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  rule?: AutomationRule;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: AutomationRuleFormData) => void;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await tagsService.getAll()).results ?? [],
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
  const [name, setName] = useState(rule?.name ?? '');
  const [desc, setDesc] = useState(rule?.description ?? '');
  const [logic, setLogic] = useState<'all' | 'any'>(rule?.logic ?? 'all');
  const [priority, setPriority] = useState(rule?.priority ?? 100);
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [conditions, setConditions] = useState<AutomationCondition[]>(
    rule?.conditions ?? [{ field: 'merchant', operator: 'contains', value: '' }]
  );
  const [actions, setActions] = useState<AutomationAction[]>(
    rule?.actions ?? [{ type: 'set_category', value: '' }]
  );

  const updateCondition = (i: number, c: AutomationCondition) => {
    setConditions((prev) => prev.map((x, idx) => (idx === i ? c : x)));
  };
  const removeCondition = (i: number) =>
    setConditions((prev) => prev.filter((_, idx) => idx !== i));
  const addCondition = () =>
    setConditions((prev) => [
      ...prev,
      { field: 'merchant', operator: 'contains', value: '' },
    ]);

  const updateAction = (i: number, a: AutomationAction) =>
    setActions((prev) => prev.map((x, idx) => (idx === i ? a : x)));
  const removeAction = (i: number) =>
    setActions((prev) => prev.filter((_, idx) => idx !== i));
  const addAction = () =>
    setActions((prev) => [...prev, { type: 'set_category', value: '' }]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || conditions.length === 0 || actions.length === 0) return;
    onSubmit({
      name: name.trim(),
      description: desc.trim() || undefined,
      logic,
      conditions,
      actions,
      is_active: isActive,
      priority,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader sticky>
          <DialogTitle mode={rule ? 'edit' : 'create'}>
            {rule
              ? t('pages.automationRules.editRule')
              : t('pages.automationRules.newRule')}
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>{t('pages.automationRules.subtitle')}</DialogDescription>
          </VisuallyHidden>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-lg">
          {/* Básico */}
          <div className="gap-md grid grid-cols-1 md:grid-cols-2">
            <div className="space-y-sm">
              <Label htmlFor="rule-name">
                {t('pages.automationRules.form.nameLabel')}
              </Label>
              <Input
                id="rule-name"
                placeholder={t('pages.automationRules.form.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-sm">
              <Label htmlFor="rule-desc">
                {t('pages.automationRules.form.descLabel')}
              </Label>
              <Input
                id="rule-desc"
                placeholder={t('pages.automationRules.form.descPlaceholder')}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>

            <div className="gap-md grid grid-cols-3 md:col-span-2">
              <div className="space-y-sm flex flex-col items-center">
                <Label htmlFor="rule-priority">
                  {t('pages.automationRules.form.priorityLabel')}
                </Label>
                <NumberStepper
                  id="rule-priority"
                  min={1}
                  max={9999}
                  value={priority}
                  onChange={(v) => setPriority(v ?? 100)}
                />
              </div>

              <div className="space-y-sm flex flex-col items-center">
                <Label>{t('pages.automationRules.logic')}</Label>
                <Select
                  value={logic}
                  onValueChange={(v) => setLogic(v as 'all' | 'any')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('pages.automationRules.logicAll')}
                    </SelectItem>
                    <SelectItem value="any">
                      {t('pages.automationRules.logicAny')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-sm flex flex-col items-center">
                <Label>{t('pages.automationRules.form.isActiveLabel')}</Label>
                <div className="gap-sm flex items-center">
                  <StatusToggle
                    value={isActive ? 'active' : 'inactive'}
                    onChange={(v) => setIsActive(v === 'active')}
                    options={[
                      {
                        value: 'active',
                        label: t('pages.automationRules.active'),
                        accentColor: 'success',
                      },
                      {
                        value: 'inactive',
                        label: t('pages.automationRules.inactive'),
                      },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Condições */}
          <div className="space-y-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                {t('pages.automationRules.conditions')}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                <Plus className="h-3.5 w-3.5" />
                {t('pages.automationRules.addCondition')}
              </Button>
            </div>
            <PaginatedSlide
              items={conditions}
              pageSize={2}
              pinNav={false}
              className="space-y-sm"
            >
              {(pageConditions) =>
                pageConditions.map((c) => {
                  const i = conditions.indexOf(c);
                  return (
                    <ConditionRow
                      key={i}
                      condition={c}
                      index={i}
                      accounts={accounts}
                      onChange={updateCondition}
                      onRemove={removeCondition}
                    />
                  );
                })
              }
            </PaginatedSlide>
          </div>

          {/* Ações */}
          <div className="space-y-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                {t('pages.automationRules.actions')}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={addAction}>
                <Plus className="h-3.5 w-3.5" />
                {t('pages.automationRules.addAction')}
              </Button>
            </div>
            <PaginatedSlide
              items={actions}
              pageSize={2}
              pinNav={false}
              className="space-y-sm"
            >
              {(pageActions) =>
                pageActions.map((a) => {
                  const i = actions.indexOf(a);
                  return (
                    <ActionRow
                      key={i}
                      action={a}
                      index={i}
                      tags={tags}
                      onChange={updateAction}
                      onRemove={removeAction}
                    />
                  );
                })
              }
            </PaginatedSlide>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !name.trim() ||
                conditions.length === 0 ||
                actions.length === 0
              }
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isLoading ? t('common.actions.saving') : t('common.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RuleDetailsDialog({
  rule,
  open,
  onOpenChange,
}: {
  rule: AutomationRule;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center">
            <Zap className="text-primary h-5 w-5 shrink-0" />
            {rule.name}
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>{rule.name}</DialogDescription>
          </VisuallyHidden>
        </DialogHeader>
        <div className="gap-md grid md:grid-cols-2">
          <div>
            <p className="mb-xs text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {t('pages.automationRules.conditions')} (
              {rule.logic === 'all' ? 'AND' : 'OR'})
            </p>
            <div className="space-y-xs">
              {rule.conditions.map((c, i) => (
                <div key={i} className="gap-xs flex items-center text-sm">
                  <Badge variant="outline" className="text-xs">
                    {t(`pages.automationRules.fields.${c.field}`)}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {t(`pages.automationRules.operators.${c.operator}`)}
                  </span>
                  <span className="text-xs font-medium">
                    {c.field === 'category'
                      ? translate('expenseCategories', c.value)
                      : c.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-xs text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {t('pages.automationRules.actions')}
            </p>
            <div className="space-y-xs">
              {rule.actions.map((a, i) => (
                <div key={i} className="gap-xs flex items-center text-sm">
                  <Badge variant="secondary" className="text-xs">
                    {t(`pages.automationRules.actionTypes.${a.type}`)}
                  </Badge>
                  <span className="text-xs font-medium">
                    {a.type === 'set_category'
                      ? translate('expenseCategories', a.value)
                      : a.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}

function RuleCard({
  rule,
  onEdit,
  onDelete,
  onOpenDetails,
}: {
  rule: AutomationRule;
  onEdit: (r: AutomationRule) => void;
  onDelete: (id: number) => void;
  onOpenDetails: (r: AutomationRule) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="border-border bg-card hover:bg-muted/30 p-md gap-sm flex cursor-pointer items-start justify-between rounded-lg border transition"
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetails(rule)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpenDetails(rule);
      }}
    >
      <div className="flex-1">
        <div className="gap-sm flex items-center">
          <span className="font-semibold">{rule.name}</span>
          <Badge
            variant="outline"
            className={
              rule.is_active
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                : 'border-border bg-muted text-muted-foreground'
            }
          >
            {rule.is_active
              ? t('pages.automationRules.active')
              : t('pages.automationRules.inactive')}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            #{rule.priority}
          </Badge>
        </div>
        {rule.description && (
          <p className="mt-xs text-muted-foreground text-sm">{rule.description}</p>
        )}
        <p className="mt-xs text-muted-foreground text-xs">
          {rule.apply_count} {t('pages.automationRules.applied')}
        </p>
      </div>

      <div className="gap-xs flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(rule);
          }}
        >
          <span className="sr-only">{t('common.actions.edit')}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </Button>
        <Button
          aria-label={t('common.actions.delete')}
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(rule.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function EmbeddedWrapper({ children }: { children: React.ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function AutomationRules({
  embedded = false,
  newRuleRef,
  applyAllRef,
}: {
  embedded?: boolean;
  newRuleRef?: RefObject<(() => void) | undefined>;
  applyAllRef?: RefObject<(() => void) | undefined>;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { showConfirm } = useAlertDialog();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | undefined>();
  const [detailsRule, setDetailsRule] = useState<AutomationRule | undefined>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (newRuleRef) {
      newRuleRef.current = () => {
        setEditingRule(undefined);
        setFormOpen(true);
      };
    }
  });

  const { data, isLoading } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: () => automationRulesService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const rules: AutomationRule[] = Array.isArray(data)
    ? data
    : ((data as { results: AutomationRule[] } | undefined)?.results ?? []);

  const filteredRules = rules.filter((rule) => {
    if (searchTerm && !rule.name.toLowerCase().includes(searchTerm.toLowerCase()))
      return false;
    if (statusFilter !== 'all' && rule.is_active !== (statusFilter === 'active'))
      return false;
    return true;
  });

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  const createMutation = useMutation({
    mutationFn: (d: AutomationRuleFormData) => automationRulesService.create(d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast({ title: t('pages.automationRules.createSuccess') });
      setFormOpen(false);
      setEditingRule(undefined);
    },
    onError: (e) => {
      toast({ title: getErrorMessage(e), variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AutomationRuleFormData }) =>
      automationRulesService.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast({ title: t('pages.automationRules.updateSuccess') });
      setFormOpen(false);
      setEditingRule(undefined);
    },
    onError: (e) => {
      toast({ title: getErrorMessage(e), variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => automationRulesService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast({ title: t('pages.automationRules.deleteSuccess') });
    },
    onError: (e) => {
      toast({ title: getErrorMessage(e), variant: 'destructive' });
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => automationRulesService.applyRules(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast({
        title: t('pages.automationRules.applySuccessDesc', {
          count: res.applied,
        }),
      });
    },
    onError: (e) => {
      toast({ title: getErrorMessage(e), variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (applyAllRef) {
      applyAllRef.current = () => applyMutation.mutate();
    }
  });

  const handleSubmit = (d: AutomationRuleFormData) => {
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: d });
    } else {
      createMutation.mutate(d);
    }
  };

  const handleEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    const ok = await showConfirm({
      title: t('common.actions.delete'),
      description: t('pages.automationRules.deleteConfirm'),
    });
    if (ok) deleteMutation.mutate(id);
  };

  const handleOpenDetails = (rule: AutomationRule) => {
    setDetailsRule(rule);
    setDetailsOpen(true);
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  return (
    <Wrapper>
      {isLoading ? (
        <LoadingState />
      ) : rules.length === 0 ? (
        <EmptyState
          icon={<Zap className="h-6 w-6" />}
          title={t('pages.automationRules.empty')}
        />
      ) : (
        <>
          <FilterBar
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
            activeFilters={[
              ...(statusFilter !== 'all'
                ? [
                    {
                      key: 'status',
                      label: `${t('common.fields.status')}: ${
                        statusFilter === 'active'
                          ? t('pages.automationRules.active')
                          : t('pages.automationRules.inactive')
                      }`,
                      onRemove: () => setStatusFilter('all'),
                    },
                  ]
                : []),
            ]}
          >
            <SearchInput
              placeholder={t('pages.automationRules.searchPlaceholder')}
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="w-44"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                className="w-36"
                aria-label={t('pages.automationRules.allStatus')}
                startIcon={<CircleDot className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.automationRules.allStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.automationRules.allStatus')}
                </SelectItem>
                <SelectItem value="active">
                  {t('pages.automationRules.active')}
                </SelectItem>
                <SelectItem value="inactive">
                  {t('pages.automationRules.inactive')}
                </SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>

          {filteredRules.length === 0 ? (
            <EmptyState
              icon={<Zap className="h-6 w-6" />}
              title={t('pages.automationRules.empty')}
            />
          ) : (
            <PaginatedSlide
              items={filteredRules}
              pageSize={5}
              centerList
              className="space-y-sm"
            >
              {(pageItems) =>
                pageItems.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onEdit={handleEdit}
                    onDelete={(id) => void handleDelete(id)}
                    onOpenDetails={handleOpenDetails}
                  />
                ))
              }
            </PaginatedSlide>
          )}
        </>
      )}

      <RuleFormDialog
        key={editingRule?.id ?? 'new'}
        rule={editingRule}
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditingRule(undefined);
        }}
        onSubmit={handleSubmit}
        isLoading={isMutating}
      />

      {detailsRule && (
        <RuleDetailsDialog
          rule={detailsRule}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}
    </Wrapper>
  );
}
