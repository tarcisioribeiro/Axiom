/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, History, Plus, Trash2, Zap } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusToggle } from '@/components/ui/status-toggle';
import { EXPENSE_CATEGORIES_CANONICAL, translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { automationRulesService } from '@/services/automation-rules-service';
import type {
  AutomationAction,
  AutomationActionType,
  AutomationCondition,
  AutomationConditionField,
  AutomationOperator,
  AutomationRule,
  AutomationRuleFormData,
  AutomationRuleLog,
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

const OPERATORS: AutomationOperator[] = [
  'contains',
  'not_contains',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
];

const ACTION_TYPES: AutomationActionType[] = [
  'set_category',
  'add_tag',
  'create_alert',
];

function ConditionRow({
  condition,
  index,
  onChange,
  onRemove,
}: {
  condition: AutomationCondition;
  index: number;
  onChange: (i: number, c: AutomationCondition) => void;
  onRemove: (i: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-sm rounded-lg border border-border/60 bg-muted/20 p-sm">
      <Select
        value={condition.field}
        onValueChange={(v) =>
          onChange(index, { ...condition, field: v as AutomationConditionField })
        }
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
          {OPERATORS.map((op) => (
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
            {EXPENSE_CATEGORIES_CANONICAL.map((cat) => (
              <SelectItem key={cat.key} value={cat.key}>
                {translate('expenseCategories', cat.key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
  onChange,
  onRemove,
}: {
  action: AutomationAction;
  index: number;
  onChange: (i: number, a: AutomationAction) => void;
  onRemove: (i: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-sm rounded-lg border border-border/60 bg-muted/20 p-sm">
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
            {EXPENSE_CATEGORIES_CANONICAL.map((cat) => (
              <SelectItem key={cat.key} value={cat.key}>
                {translate('expenseCategories', cat.key)}
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
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {rule ? t('common.actions.edit') : t('pages.automationRules.newRule')}
          </DialogTitle>
          <DialogDescription>{t('pages.automationRules.subtitle')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-lg">
          {/* Básico */}
          <div className="grid grid-cols-1 gap-md md:grid-cols-2">
            <div className="space-y-sm md:col-span-2">
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

            <div className="space-y-sm md:col-span-2">
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

            <div className="space-y-sm">
              <Label htmlFor="rule-priority">
                {t('pages.automationRules.form.priorityLabel')}
              </Label>
              <Input
                id="rule-priority"
                type="number"
                min={1}
                max={9999}
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 100)}
              />
            </div>

            <div className="space-y-sm">
              <Label>{t('pages.automationRules.logic')}</Label>
              <Select value={logic} onValueChange={(v) => setLogic(v as 'all' | 'any')}>
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

            <div className="flex items-center gap-sm">
              <StatusToggle
                value={isActive ? 'active' : 'inactive'}
                onChange={(v) => setIsActive(v === 'active')}
                options={[
                  {
                    value: 'active',
                    label: t('pages.automationRules.active'),
                    activeClass:
                      'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
                  },
                  {
                    value: 'inactive',
                    label: t('pages.automationRules.inactive'),
                    activeClass: 'bg-muted text-muted-foreground border-border',
                  },
                ]}
              />
            </div>
          </div>

          {/* Condições */}
          <div className="space-y-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('pages.automationRules.conditions')}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                <Plus className="mr-xs h-3.5 w-3.5" />
                {t('pages.automationRules.addCondition')}
              </Button>
            </div>
            <div className="space-y-sm">
              {conditions.map((c, i) => (
                <ConditionRow
                  key={i}
                  condition={c}
                  index={i}
                  onChange={updateCondition}
                  onRemove={removeCondition}
                />
              ))}
            </div>
          </div>

          {/* Ações */}
          <div className="space-y-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('pages.automationRules.actions')}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={addAction}>
                <Plus className="mr-xs h-3.5 w-3.5" />
                {t('pages.automationRules.addAction')}
              </Button>
            </div>
            <div className="space-y-sm">
              {actions.map((a, i) => (
                <ActionRow
                  key={i}
                  action={a}
                  index={i}
                  onChange={updateAction}
                  onRemove={removeAction}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
              {isLoading ? t('common.actions.saving') : t('common.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RuleLogsDialog({
  rule,
  open,
  onOpenChange,
}: {
  rule: AutomationRule;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const { data: logs = [], isLoading } = useQuery<AutomationRuleLog[]>({
    queryKey: ['automation-rule-logs', rule.id],
    queryFn: () => automationRulesService.getLogs(rule.id),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('pages.automationRules.logsTitle')} — {rule.name}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <LoadingState />
        ) : logs.length === 0 ? (
          <p className="py-md text-center text-sm text-muted-foreground">
            {t('pages.automationRules.noLogs')}
          </p>
        ) : (
          <div className="max-h-96 space-y-sm overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-border/60 bg-muted/20 p-sm text-sm"
              >
                <p className="font-medium">{log.expense_description}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString('pt-BR')}
                </p>
                <div className="mt-xs flex flex-wrap gap-xs">
                  {log.actions_applied.map((a, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
  onViewLogs,
}: {
  rule: AutomationRule;
  onEdit: (r: AutomationRule) => void;
  onDelete: (id: number) => void;
  onToggle: (r: AutomationRule) => void;
  onViewLogs: (r: AutomationRule) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border/60 bg-card p-md transition-all hover:shadow-sm">
      <div className="flex items-start justify-between gap-sm">
        <div className="flex-1">
          <div className="flex items-center gap-sm">
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
            <p className="mt-xs text-sm text-muted-foreground">{rule.description}</p>
          )}
          <p className="mt-xs text-xs text-muted-foreground">
            {rule.apply_count} {t('pages.automationRules.applied')}
          </p>
        </div>

        <div className="flex items-center gap-xs">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={t('pages.automationRules.logsTitle')}
            onClick={() => onViewLogs(rule)}
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onToggle(rule)}
            title={
              rule.is_active
                ? t('pages.automationRules.inactive')
                : t('pages.automationRules.active')
            }
          >
            <Zap
              className={`h-3.5 w-3.5 ${rule.is_active ? 'text-primary' : 'text-muted-foreground'}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(rule)}
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
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(rule.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-md grid gap-sm border-t border-border/40 pt-md md:grid-cols-2">
          <div>
            <p className="mb-xs text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('pages.automationRules.conditions')} (
              {rule.logic === 'all' ? 'AND' : 'OR'})
            </p>
            <div className="space-y-xs">
              {rule.conditions.map((c, i) => (
                <div key={i} className="flex items-center gap-xs text-sm">
                  <Badge variant="outline" className="text-xs">
                    {t(`pages.automationRules.fields.${c.field}`)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t(`pages.automationRules.operators.${c.operator}`)}
                  </span>
                  <span className="font-mono text-xs font-medium">
                    {c.field === 'category'
                      ? translate('expenseCategories', c.value)
                      : c.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-xs text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('pages.automationRules.actions')}
            </p>
            <div className="space-y-xs">
              {rule.actions.map((a, i) => (
                <div key={i} className="flex items-center gap-xs text-sm">
                  <Badge variant="secondary" className="text-xs">
                    {t(`pages.automationRules.actionTypes.${a.type}`)}
                  </Badge>
                  <span className="font-mono text-xs font-medium">
                    {a.type === 'set_category'
                      ? translate('expenseCategories', a.value)
                      : a.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmbeddedWrapper({ children }: { children: React.ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function AutomationRules({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { showConfirm } = useAlertDialog();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | undefined>();
  const [logsRule, setLogsRule] = useState<AutomationRule | undefined>();
  const [logsOpen, setLogsOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: () => automationRulesService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const rules: AutomationRule[] = Array.isArray(data)
    ? data
    : ((data as { results: AutomationRule[] } | undefined)?.results ?? []);

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
      toast({
        title: t('pages.automationRules.applySuccess'),
        description: t('pages.automationRules.applySuccessDesc', {
          count: res.applied,
        }),
      });
    },
    onError: (e) => {
      toast({ title: getErrorMessage(e), variant: 'destructive' });
    },
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

  const handleToggle = (rule: AutomationRule) => {
    updateMutation.mutate({
      id: rule.id,
      data: {
        name: rule.name,
        description: rule.description ?? undefined,
        logic: rule.logic,
        conditions: rule.conditions,
        actions: rule.actions,
        is_active: !rule.is_active,
        priority: rule.priority,
      },
    });
  };

  const handleViewLogs = (rule: AutomationRule) => {
    setLogsRule(rule);
    setLogsOpen(true);
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  return (
    <Wrapper>
      <PageHeader
        title={t('pages.automationRules.title')}
        subtitle={t('pages.automationRules.subtitle')}
        actions={
          <div className="flex gap-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
            >
              <Zap className="mr-xs h-3.5 w-3.5" />
              {t('pages.automationRules.applyAll')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingRule(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-xs h-3.5 w-3.5" />
              {t('pages.automationRules.newRule')}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : rules.length === 0 ? (
        <EmptyState
          title={t('pages.automationRules.empty')}
          description={t('pages.automationRules.emptyDesc')}
          action={{
            label: t('pages.automationRules.newRule'),
            onClick: () => {
              setEditingRule(undefined);
              setFormOpen(true);
            },
          }}
        />
      ) : (
        <div className="space-y-sm">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={handleEdit}
              onDelete={(id) => void handleDelete(id)}
              onToggle={handleToggle}
              onViewLogs={handleViewLogs}
            />
          ))}
        </div>
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

      {logsRule && (
        <RuleLogsDialog rule={logsRule} open={logsOpen} onOpenChange={setLogsOpen} />
      )}
    </Wrapper>
  );
}
