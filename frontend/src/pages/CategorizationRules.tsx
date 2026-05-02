import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Tag, Trash2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { EXPENSE_CATEGORIES_CANONICAL, translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { categorizationRulesService } from '@/services/categorization-rules-service';
import type { CategorizationRule, CategorizationRuleFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'food and drink': '🍽️',
    supermarket: '🛒',
    transport: '🚗',
    'bills and services': '⚡',
    entertainment: '🎬',
    education: '📚',
    'health and care': '❤️',
    house: '🏠',
    vestuary: '👔',
    travels: '✈️',
    investments: '📈',
    electronics: '💻',
    'digital signs': '📱',
    others: '📦',
  };
  return icons[category] ?? '📦';
}

function getCategoryBg(category: string): string {
  const bgs: Record<string, string> = {
    'food and drink': 'bg-orange-500/10',
    supermarket: 'bg-green-500/10',
    transport: 'bg-blue-500/10',
    'bills and services': 'bg-yellow-500/10',
    entertainment: 'bg-purple-500/10',
    education: 'bg-cyan-500/10',
    'health and care': 'bg-red-500/10',
    house: 'bg-teal-500/10',
    vestuary: 'bg-pink-500/10',
    travels: 'bg-indigo-500/10',
    investments: 'bg-emerald-500/10',
    electronics: 'bg-sky-500/10',
    'digital signs': 'bg-violet-500/10',
  };
  return bgs[category] ?? 'bg-muted';
}

function RuleForm({
  rule,
  onSubmit,
  onCancel,
  isLoading,
}: {
  rule?: CategorizationRule;
  onSubmit: (data: CategorizationRuleFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();
  const [merchantContains, setMerchantContains] = useState(
    rule?.merchant_contains ?? ''
  );
  const [category, setCategory] = useState(rule?.category ?? '');
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [priority, setPriority] = useState(rule?.priority ?? 100);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!merchantContains.trim() || !category) return;
    onSubmit({
      merchant_contains: merchantContains.trim(),
      category,
      is_active: isActive,
      priority,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-md">
      <div className="space-y-sm">
        <Label htmlFor="merchant_contains">
          {t('pages.categorizationRules.form.merchantContains')} *
        </Label>
        <Input
          id="merchant_contains"
          placeholder={t('pages.categorizationRules.form.merchantContainsPlaceholder')}
          value={merchantContains}
          onChange={(e) => setMerchantContains(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          {t('pages.categorizationRules.form.merchantContainsHint')}
        </p>
      </div>

      <div className="space-y-sm">
        <Label htmlFor="category">
          {t('pages.categorizationRules.form.category')} *
        </Label>
        <Select value={category} onValueChange={setCategory} required>
          <SelectTrigger id="category">
            <SelectValue
              placeholder={t('pages.categorizationRules.form.categoryPlaceholder')}
            />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_CATEGORIES_CANONICAL.map((cat) => (
              <SelectItem key={cat.key} value={cat.key}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-sm">
        <Label htmlFor="priority">{t('pages.categorizationRules.form.priority')}</Label>
        <Input
          id="priority"
          type="number"
          min={1}
          step={1}
          value={priority}
          onChange={(e) => setPriority(Math.max(1, Number(e.target.value)))}
        />
        <p className="text-xs text-muted-foreground">
          {t('pages.categorizationRules.form.priorityHint')}
        </p>
      </div>

      <div className="flex items-center gap-sm">
        <Checkbox
          id="is_active"
          checked={isActive}
          onCheckedChange={(checked) => setIsActive(checked === true)}
        />
        <Label htmlFor="is_active" className="cursor-pointer">
          {t('pages.categorizationRules.form.isActive')}
        </Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !merchantContains.trim() || !category}
        >
          {isLoading
            ? t('common.actions.saving')
            : rule
              ? t('common.actions.save')
              : t('pages.categorizationRules.newBtn')}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function CategorizationRules() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CategorizationRule | undefined>();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['categorizationRules'],
    queryFn: () => categorizationRulesService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['categorizationRules'] });

  const createMutation = useMutation({
    mutationFn: (data: CategorizationRuleFormData) =>
      categorizationRulesService.create(data),
    onSuccess: () => {
      void invalidate();
      toast({
        title: t('pages.categorizationRules.created'),
        description: t('pages.categorizationRules.createdDesc'),
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t('pages.categorizationRules.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CategorizationRuleFormData }) =>
      categorizationRulesService.update(id, data),
    onSuccess: () => {
      void invalidate();
      toast({
        title: t('pages.categorizationRules.updated'),
        description: t('pages.categorizationRules.updatedDesc'),
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t('pages.categorizationRules.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categorizationRulesService.delete(id),
    onSuccess: () => {
      void invalidate();
      toast({
        title: t('pages.categorizationRules.deleted'),
        description: t('pages.categorizationRules.deletedDesc'),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('pages.categorizationRules.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => categorizationRulesService.applyRules(),
    onSuccess: (result) => {
      toast({
        title: t('pages.categorizationRules.applied'),
        description: t('pages.categorizationRules.appliedDesc', {
          count: result.updated,
        }),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('pages.categorizationRules.applyError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  function handleCreate() {
    setSelectedItem(undefined);
    setIsDialogOpen(true);
  }

  function handleEdit(rule: CategorizationRule) {
    setSelectedItem(rule);
    setIsDialogOpen(true);
  }

  async function handleDelete(id: number) {
    const confirmed = await showConfirm({
      title: t('pages.categorizationRules.deleteTitle'),
      description: t('pages.categorizationRules.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (confirmed) deleteMutation.mutate(id);
  }

  function handleSubmit(data: CategorizationRuleFormData) {
    if (selectedItem) {
      updateMutation.mutate({ id: selectedItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isLoading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader title={t('pages.categorizationRules.title')} icon={<Tag />}>
        <Button
          variant="outline"
          onClick={() => applyMutation.mutate()}
          disabled={applyMutation.isPending || rules.length === 0}
        >
          <Wand2 className="mr-2 h-4 w-4" />
          {applyMutation.isPending
            ? t('pages.categorizationRules.applying')
            : t('pages.categorizationRules.applyBtn')}
        </Button>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('pages.categorizationRules.newBtn')}
        </Button>
      </PageHeader>

      {/* Informational banner */}
      <div className="mb-md rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
        <div className="flex items-start gap-3">
          <Wand2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
          <div>
            <p className="text-sm font-medium text-blue-500">
              Categorização automática
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Quando uma despesa é criada com descrição contendo o padrão da regra, ela
              é automaticamente categorizada. Regras com menor número de prioridade são
              aplicadas primeiro.
            </p>
          </div>
        </div>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon={<Tag className="h-12 w-12" />}
          title={t('pages.categorizationRules.emptyTitle')}
          message={t('pages.categorizationRules.emptyMessage')}
        />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border bg-card p-4',
                !rule.is_active && 'opacity-50'
              )}
            >
              {/* Left: merchant pattern → category flow */}
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                {/* Merchant pattern chip */}
                <div className="flex flex-shrink-0 items-center gap-2 rounded-md bg-muted px-3 py-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">contém</p>
                    <p className="font-mono text-sm font-semibold">
                      &ldquo;{rule.merchant_contains}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex flex-shrink-0 items-center gap-1 text-muted-foreground">
                  <div className="h-px w-6 bg-border" />
                  <svg
                    width="8"
                    height="12"
                    viewBox="0 0 8 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M1 1l6 5-6 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* Target category chip */}
                <div
                  className={cn(
                    'flex flex-shrink-0 items-center gap-2 rounded-md px-3 py-2',
                    getCategoryBg(rule.category)
                  )}
                >
                  <span className="text-lg" aria-hidden="true">
                    {getCategoryIcon(rule.category)}
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">categorizar como</p>
                    <p className="text-sm font-semibold">
                      {translate('expenseCategories', rule.category)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: priority + status badges + actions */}
              <div className="flex flex-shrink-0 items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  #{rule.priority}
                </Badge>
                {!rule.is_active && (
                  <Badge variant="secondary">
                    {t('pages.categorizationRules.form.statusInactive')}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(rule)}
                  title={t('common.actions.edit')}
                  aria-label={t('common.actions.edit')}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDelete(rule.id)}
                  title={t('common.actions.delete')}
                  aria-label={t('common.actions.delete')}
                  className="text-destructive hover:text-destructive"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedItem
                ? t('pages.categorizationRules.editTitle')
                : t('pages.categorizationRules.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedItem
                ? t('pages.categorizationRules.editDesc')
                : t('pages.categorizationRules.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <RuleForm
            rule={selectedItem}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
