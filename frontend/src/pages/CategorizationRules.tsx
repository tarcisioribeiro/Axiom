import { Pencil, Plus, Tag, Trash2, Wand2 } from 'lucide-react';
import { useState } from 'react';

import { DataTable, type Column } from '@/components/common/DataTable';
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
import { useCrudPage } from '@/hooks/use-crud-page';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/formatters';
import { categorizationRulesService } from '@/services/categorization-rules-service';
import type { CategorizationRule, CategorizationRuleFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

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
        <Label htmlFor="merchant_contains">Estabelecimento contém</Label>
        <Input
          id="merchant_contains"
          placeholder="Ex: McDonald, Uber, Netflix"
          value={merchantContains}
          onChange={(e) => setMerchantContains(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Texto buscado no campo "Estabelecimento" da despesa (sem distinção de
          maiúsculas).
        </p>
      </div>

      <div className="space-y-sm">
        <Label htmlFor="category">Categoria</Label>
        <Select value={category} onValueChange={setCategory} required>
          <SelectTrigger id="category">
            <SelectValue placeholder="Selecione uma categoria" />
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
        <Label htmlFor="priority">Prioridade</Label>
        <Input
          id="priority"
          type="number"
          min={1}
          value={priority}
          onChange={(e) => setPriority(Math.max(1, Number(e.target.value)))}
        />
        <p className="text-xs text-muted-foreground">
          Menor valor = maior prioridade. Regras com valor menor são avaliadas primeiro.
        </p>
      </div>

      <div className="flex items-center gap-sm">
        <Checkbox
          id="is_active"
          checked={isActive}
          onCheckedChange={(checked) => setIsActive(checked === true)}
        />
        <Label htmlFor="is_active" className="cursor-pointer">
          Regra ativa
        </Label>
      </div>

      <div className="flex justify-end gap-sm pt-sm">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !merchantContains.trim() || !category}
        >
          {isLoading ? 'Salvando...' : rule ? 'Salvar Alterações' : 'Criar Regra'}
        </Button>
      </div>
    </form>
  );
}

export default function CategorizationRules() {
  const { toast } = useToast();
  const [isApplying, setIsApplying] = useState(false);

  const {
    items: rules,
    isLoading,
    isSubmitting,
    isDialogOpen,
    selectedItem,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
    closeDialog,
  } = useCrudPage(categorizationRulesService, {
    resourceName: 'regra',
    resourceNamePlural: 'regras',
    messages: {
      createSuccess: 'Regra de categorização criada com sucesso',
      updateSuccess: 'Regra de categorização atualizada com sucesso',
      deleteSuccess: 'Regra de categorização excluída. Desfazer?',
    },
  });

  async function handleApplyRules() {
    setIsApplying(true);
    try {
      const result = await categorizationRulesService.applyRules();
      toast({
        title: 'Regras aplicadas',
        description: `${result.updated} despesa(s) categorizada(s) automaticamente.`,
        variant: 'default',
      });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao aplicar regras',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsApplying(false);
    }
  }

  const columns: Column<CategorizationRule>[] = [
    {
      key: 'merchant_contains',
      label: 'Estabelecimento contém',
      render: (rule) => (
        <span className="font-mono text-sm">{rule.merchant_contains}</span>
      ),
    },
    {
      key: 'category',
      label: 'Categoria',
      render: (rule) => (
        <Badge variant="secondary">
          {translate('expenseCategories', rule.category)}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (rule) =>
        rule.is_active ? (
          <Badge variant="success">Ativa</Badge>
        ) : (
          <Badge variant="outline">Inativa</Badge>
        ),
    },
    {
      key: 'priority',
      label: 'Prioridade',
      sortable: true,
      render: (rule) => <span className="text-sm tabular-nums">{rule.priority}</span>,
    },
    {
      key: 'created_at',
      label: 'Criada em',
      render: (rule) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(rule.created_at)}
        </span>
      ),
    },
  ];

  if (isLoading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader title="Regras de Categorização">
        <Button
          variant="outline"
          onClick={() => void handleApplyRules()}
          disabled={isApplying || rules.length === 0}
        >
          <Wand2 className="mr-2 h-4 w-4" />
          {isApplying ? 'Aplicando...' : 'Aplicar Regras'}
        </Button>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Regra
        </Button>
      </PageHeader>

      {rules.length === 0 ? (
        <EmptyState
          icon={<Tag className="h-12 w-12" />}
          title="Nenhuma regra cadastrada"
          message="Crie regras para categorizar automaticamente suas despesas com base no estabelecimento."
        />
      ) : (
        <DataTable
          data={rules}
          columns={columns}
          keyExtractor={(rule) => rule.id}
          actions={(rule) => (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(rule)}
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleDelete(rule.id)}
                title="Excluir"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedItem ? 'Editar Regra' : 'Nova Regra de Categorização'}
            </DialogTitle>
          </DialogHeader>
          <RuleForm
            rule={selectedItem}
            onSubmit={(data) => void handleSubmit(data)}
            onCancel={closeDialog}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
