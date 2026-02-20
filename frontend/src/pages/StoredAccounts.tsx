import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Copy,
  Building2,
  Wallet,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StoredAccountForm } from '@/components/security/StoredAccountForm';
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
import { accountsService } from '@/services/accounts-service';
import { membersService } from '@/services/members-service';
import { storedAccountsService } from '@/services/stored-accounts-service';
import type {
  StoredBankAccount,
  StoredBankAccountFormData,
  Account,
  Member,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const ACCOUNT_TYPES: Record<string, string> = {
  CC: 'Conta Corrente',
  CS: 'Conta Salário',
  CP: 'Conta Poupança',
  CI: 'Conta Investimento',
  OTHER: 'Outro',
};

export default function StoredAccounts() {
  const [accounts, setAccounts] = useState<StoredBankAccount[]>([]);
  const [financeAccounts, setFinanceAccounts] = useState<Account[]>([]);
  const [currentUserMember, setCurrentUserMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<
    StoredBankAccount | undefined
  >();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealedData, setRevealedData] = useState<
    Map<number, { password?: string; password2?: string }>
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
      const [accountsData, financeAccountsData, memberData] = await Promise.all([
        storedAccountsService.getAll(),
        accountsService.getAll(),
        membersService.getCurrentUserMember(),
      ]);
      setAccounts(accountsData);
      setFinanceAccounts(financeAccountsData);
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
    setSelectedAccount(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (account: StoredBankAccount) => {
    setSelectedAccount(account);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir conta',
      description:
        'Tem certeza que deseja excluir esta conta armazenada? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await storedAccountsService.delete(id);
      toast({
        title: 'Conta excluída',
        description: 'A conta foi excluída com sucesso.',
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
      // Ocultar senhas
      const newMap = new Map(revealedData);
      newMap.delete(id);
      setRevealedData(newMap);
      return;
    }

    // Confirmação extra para revelar senhas
    const confirmed = await showConfirm({
      title: 'Revelar senhas',
      description:
        'Tem certeza que deseja revelar as senhas desta conta? Certifique-se de que ninguém está olhando.',
      confirmText: 'Revelar',
      cancelText: 'Cancelar',
    });

    if (!confirmed) return;

    try {
      setRevealingId(id);
      const data = await storedAccountsService.reveal(id);
      const newMap = new Map(revealedData);
      newMap.set(id, { password: data.password, password2: data.password2 });
      setRevealedData(newMap);
      toast({
        title: 'Senhas reveladas',
        description: 'As senhas da conta foram descriptografadas com sucesso.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao revelar senhas',
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

  const handleSubmit = async (data: StoredBankAccountFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedAccount) {
        // Remove campos vazios (não atualizar dados sensíveis vazios)
        const updateData = { ...data };
        if (!updateData.password) delete updateData.password;
        if (!updateData.digital_password) delete updateData.digital_password;

        await storedAccountsService.update(selectedAccount.id, updateData);
        toast({
          title: 'Conta atualizada',
          description: 'A conta foi atualizada com sucesso.',
        });
      } else {
        await storedAccountsService.create(data);
        toast({
          title: 'Conta criada',
          description: 'A conta foi criada com sucesso.',
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

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.institution_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.account_number_masked?.includes(searchTerm)
  );

  const getFinanceAccountName = (id?: number) => {
    if (!id) return 'Nenhuma';
    const account = financeAccounts.find((a) => a.id === id);
    return account ? account.account_name : 'N/A';
  };

  const columns: Column<StoredBankAccount>[] = [
    {
      key: 'name',
      label: 'Nome',
      render: (acc) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span className="font-medium">{acc.name}</span>
        </div>
      ),
    },
    {
      key: 'institution',
      label: 'Instituição',
      render: (acc) => (
        <span className="text-sm">
          {translate('institutions', acc.institution_name)}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Tipo',
      render: (acc) => (
        <Badge variant="outline">{ACCOUNT_TYPES[acc.account_type]}</Badge>
      ),
    },
    {
      key: 'account_number',
      label: 'Número',
      render: (acc) => (
        <span className="font-mono text-sm">{acc.account_number_masked}</span>
      ),
    },
    {
      key: 'agency',
      label: 'Agência',
      align: 'center',
      render: (acc) => <span className="font-mono text-sm">{acc.agency || '-'}</span>,
    },
    {
      key: 'passwords',
      label: 'Senhas',
      render: (acc) => {
        const revealed = revealedData.get(acc.id);
        if (revealed) {
          return (
            <div className="space-y-1 text-xs">
              {revealed.password && (
                <div className="flex items-center gap-2 font-mono">
                  <span>Senha 1:</span>
                  <span>{revealed.password}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(revealed.password!, 'Senha 1')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {revealed.password2 && (
                <div className="flex items-center gap-2 font-mono">
                  <span>Senha 2:</span>
                  <span>{revealed.password2}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(revealed.password2!, 'Senha 2')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        }
        return <span className="text-sm">***</span>;
      },
    },
    {
      key: 'finance_account',
      label: 'Conta Financeira',
      render: (acc) => (
        <Badge variant="outline" className="text-xs">
          {getFinanceAccountName(acc.finance_account ?? undefined)}
        </Badge>
      ),
    },
  ];

  return (
    <VaultGuard>
    <PageContainer>
      <PageHeader
        title="Contas Bancárias"
        icon={<Wallet />}
        action={{
          label: 'Nova Conta',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex gap-4">
        <Input
          placeholder="Buscar contas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <DataTable
        data={filteredAccounts}
        columns={columns}
        keyExtractor={(acc) => acc.id}
        isLoading={isLoading}
        emptyState={{
          message: 'Nenhuma conta armazenada encontrada.',
        }}
        actions={(acc) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReveal(acc.id)}
              disabled={revealingId === acc.id}
            >
              {revealingId === acc.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : revealedData.has(acc.id) ? (
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
            <Button variant="ghost" size="icon" onClick={() => handleEdit(acc)} aria-label="Editar">
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(acc.id)} aria-label="Excluir">
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAccount ? 'Editar' : 'Nova'} Conta Bancária
            </DialogTitle>
            <DialogDescription>
              {selectedAccount
                ? 'Atualize as informações da conta armazenada'
                : 'Adicione uma nova conta ao cofre seguro'}
            </DialogDescription>
          </DialogHeader>
          <StoredAccountForm
            account={selectedAccount}
            financeAccounts={financeAccounts}
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
