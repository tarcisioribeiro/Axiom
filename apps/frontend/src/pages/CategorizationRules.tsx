/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Filter, Hash, Pencil, Plus, Tag, Trash2, Zap } from 'lucide-react';
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
import { FormSection } from '@/components/ui/form-section';
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
import { EXPENSE_CATEGORY_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { categorizationRulesService } from '@/services/categorization-rules-service';
import type { CategorizationRule, CategorizationRuleFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

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
    <form onSubmit={handleSubmit} className="space-y-lg">
      {/* Preview ao vivo */}
      {merchantContains && category && (
        <div className="gap-xs border-border/60 bg-muted/30 px-sm py-sm flex items-center overflow-hidden rounded-lg border text-sm">
          <div className="bg-background px-sm py-xs rounded-md font-mono text-xs font-semibold shadow-sm">
            &ldquo;{merchantContains}&rdquo;
          </div>
          <div className="gap-xs text-muted-foreground flex items-center">
            <div className="bg-border h-px w-4" />
            <Zap className="text-primary h-3 w-3" />
          </div>
          <div className="gap-xs bg-primary/10 px-sm py-xs text-primary flex items-center rounded-md text-xs font-semibold">
            {(() => {
              const CatIcon =
                EXPENSE_CATEGORY_ICONS[category] ?? EXPENSE_CATEGORY_ICONS['others'];
              return CatIcon ? <CatIcon className="h-3.5 w-3.5" /> : null;
            })()}
            <span>{translate('expenseCategories', category)}</span>
          </div>
        </div>
      )}

      {/* Seção: Padrão da Regra */}
      <FormSection title={t('common.form.sections.basicInfo')} icon={Filter}>
        <div className="space-y-md">
          <div className="space-y-sm">
            <Label htmlFor="merchant_contains" className="gap-xs flex items-center">
              <Filter className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.categorizationRules.form.merchantContains')} *
            </Label>
            <Input
              id="merchant_contains"
              placeholder={t(
                'pages.categorizationRules.form.merchantContainsPlaceholder'
              )}
              value={merchantContains}
              onChange={(e) => setMerchantContains(e.target.value)}
              required
            />
            <p className="text-muted-foreground text-xs">
              {t('pages.categorizationRules.form.merchantContainsHint')}
            </p>
          </div>

          <div className="space-y-sm">
            <Label htmlFor="category" className="gap-xs flex items-center">
              <Tag className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.categorizationRules.form.category')} *
            </Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger id="category">
                <SelectValue
                  placeholder={t('pages.categorizationRules.form.categoryPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES_CANONICAL.map((cat) => {
                  const CatIcon = EXPENSE_CATEGORY_ICONS[cat.key];
                  return (
                    <SelectItem key={cat.key} value={cat.key}>
                      <span className="gap-sm flex items-center">
                        {CatIcon && <CatIcon className="h-4 w-4" />}
                        {translate('expenseCategories', cat.key)}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      {/* Seção: Configuração */}
      <FormSection title={t('common.form.sections.configuration')} icon={Hash}>
        <div className="space-y-md">
          <div className="space-y-sm">
            <Label htmlFor="priority" className="gap-xs flex items-center">
              <Hash className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.categorizationRules.form.priority')}
            </Label>
            <Input
              id="priority"
              type="number"
              min={1}
              step={1}
              value={priority}
              onChange={(e) => setPriority(Math.max(1, Number(e.target.value)))}
            />
            <p className="text-muted-foreground text-xs">
              {t('pages.categorizationRules.form.priorityHint')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`gap-sm p-sm flex w-full items-start rounded-lg border text-left transition ${
              isActive
                ? 'border-success/50 bg-success/5 ring-success/20 ring-1'
                : 'border-border/60 bg-muted/20 opacity-70'
            }`}
          >
            <div
              className={`mt-0.5 rounded-full p-1 ${
                isActive
                  ? 'bg-success/10 text-success'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {t('pages.categorizationRules.form.isActive')}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {isActive
                  ? t('pages.categorizationRules.form.statusActive')
                  : t('pages.categorizationRules.form.statusInactive')}
              </p>
            </div>
          </button>
        </div>
      </FormSection>

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

function EmbeddedWrapper({ children }: { children: React.ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function CategorizationRules({
  embedded = false,
}: {
  embedded?: boolean;
}) {
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

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  return (
    <Wrapper>
      <PageHeader title={t('pages.categorizationRules.title')} icon={<Tag />}>
        <Button onClick={handleCreate}>
          <Plus className="mr-sm h-4 w-4" />
          {t('pages.categorizationRules.newBtn')}
        </Button>
      </PageHeader>

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
                'bg-card p-md flex items-center gap-3 rounded-lg border',
                !rule.is_active && 'opacity-50'
              )}
            >
              {/* Left: merchant pattern → category flow */}
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                {/* Merchant pattern chip */}
                <div className="gap-sm bg-muted py-sm flex flex-shrink-0 items-center rounded-md px-3">
                  <Tag className="text-muted-foreground h-4 w-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {t('pages.categorizationRules.contains')}
                    </p>
                    <p className="font-mono text-sm font-semibold">
                      &ldquo;{rule.merchant_contains}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="gap-xs text-muted-foreground flex flex-shrink-0 items-center">
                  <div className="bg-border h-px w-6" />
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
                    'gap-sm py-sm flex flex-shrink-0 items-center rounded-md px-3',
                    getCategoryBg(rule.category)
                  )}
                >
                  {(() => {
                    const CatIcon =
                      EXPENSE_CATEGORY_ICONS[rule.category] ??
                      EXPENSE_CATEGORY_ICONS['others'];
                    return CatIcon ? (
                      <CatIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : null;
                  })()}
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {t('pages.categorizationRules.categorizeAs')}
                    </p>
                    <p className="text-sm font-semibold">
                      {translate('expenseCategories', rule.category)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: priority + status badges + actions */}
              <div className="gap-sm flex flex-shrink-0 items-center">
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
    </Wrapper>
  );
}
