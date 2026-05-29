import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { formatLocalDate } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { expensesService } from '@/services/expenses-service';
import { loansService } from '@/services/loans-service';
import { membersService } from '@/services/members-service';
import { revenuesService } from '@/services/revenues-service';
import type { Loan, LoanFormData, Account, Member } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export interface UseLoansPageReturn {
  loans: Loan[];
  accounts: Account[];
  members: Member[];
  currentUserMemberId: number | null;
  isLoading: boolean;
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  selectedLoan: Loan | undefined;
  isSubmitting: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filteredLoans: Loan[];
  handleCreate: () => void;
  handleEdit: (loan: Loan) => void;
  handleDelete: (loan: Loan) => Promise<void>;
  handleSubmit: (data: LoanFormData) => void;
}

const DEFAULT_FORM_DATA: LoanFormData = {
  description: '',
  value: 0,
  payed_value: 0,
  date: formatLocalDate(new Date()),
  horary: new Date().toTimeString().slice(0, 5),
  category: 'loans',
  account: 0,
  benefited: 0,
  creditor: 0,
  payed: false,
  installments: 1,
  payment_frequency: 'monthly',
  late_fee: 0,
  status: 'active',
};

export function useLoansPage(): UseLoansPageReturn {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const { data: loans = [], isLoading: loansLoading } = useQuery({
    queryKey: ['loans'],
    queryFn: () => loansService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    select: (data) => (Array.isArray(data) ? data : []),
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    select: (data) => (Array.isArray(data) ? data : []),
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => membersService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    select: (data) => (Array.isArray(data) ? data : []),
  });

  const { data: currentUserMember } = useQuery({
    queryKey: ['members', 'me'],
    queryFn: () => membersService.getCurrentUserMember(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const currentUserMemberId = currentUserMember?.id ?? null;

  const invalidateLoans = () => queryClient.invalidateQueries({ queryKey: ['loans'] });

  const createMutation = useMutation({
    mutationFn: async (data: LoanFormData) => {
      const { loan_type, generate_revenue, generate_expense } = data;
      const loan = await loansService.create(data);

      if (!loan_type || loan.id === undefined) return loan;

      const now = new Date();
      const horary = now.toTimeString().slice(0, 5);

      if (loan_type === 'borrowed' && generate_revenue) {
        await revenuesService.create({
          description: loan.description,
          value: parseFloat(loan.value),
          date: loan.date,
          horary,
          category: 'received_loan',
          account: loan.account,
          received: true,
        });
      }

      if (loan_type === 'lent' && generate_expense) {
        await expensesService.create({
          description: loan.description,
          value: parseFloat(loan.value),
          date: loan.date,
          horary,
          category: loan.category,
          account: loan.account,
          payed: true,
        });
      }

      return loan;
    },
    onSuccess: (_, variables) => {
      void invalidateLoans();
      const { loan_type, generate_revenue, generate_expense } = variables;
      const hasExtra =
        (loan_type === 'borrowed' && generate_revenue) ||
        (loan_type === 'lent' && generate_expense);
      toast({
        title: hasExtra
          ? loan_type === 'borrowed'
            ? t('pages.loans.loanCreatedWithRevenue')
            : t('pages.loans.loanCreatedWithExpense')
          : t('pages.loans.created'),
        description: hasExtra
          ? loan_type === 'borrowed'
            ? t('pages.loans.loanCreatedWithRevenueDesc')
            : t('pages.loans.loanCreatedWithExpenseDesc')
          : t('pages.loans.createdDesc', {
              defaultValue: 'O empréstimo foi criado com sucesso.',
            }),
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Omit<LoanFormData, 'payed_value'>;
    }) => loansService.update(id, data),
    onSuccess: () => {
      void invalidateLoans();
      toast({
        title: t('pages.loans.updated'),
        description: 'O empréstimo foi atualizado com sucesso.',
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => loansService.delete(id),
    onSuccess: () => {
      void invalidateLoans();
      toast({
        title: t('pages.loans.deleted'),
        description: t('pages.loans.deletedDesc'),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const isLoading = loansLoading || accountsLoading || membersLoading;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleCreate = () => {
    if (accounts.length === 0 || members.length === 0) {
      const missing = [];
      if (accounts.length === 0) missing.push('contas');
      if (members.length === 0) missing.push('membros');
      toast({
        title: t('common.messages.actionDenied'),
        description: t('pages.loans.noPrerequisitesMsg', {
          missing: missing.join(' e '),
        }),
        variant: 'destructive',
      });
      return;
    }
    setSelectedLoan(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (loan: Loan) => {
    setSelectedLoan(loan);
    setIsDialogOpen(true);
  };

  const handleDelete = async (loan: Loan) => {
    const confirmed = await showConfirm({
      title: t('pages.loans.deleteTitle'),
      description: t('pages.loans.deleteDesc', { name: loan.description }),
    });
    if (!confirmed) return;
    deleteMutation.mutate(loan.id);
  };

  const handleSubmit = (data: LoanFormData) => {
    if (selectedLoan) {
      const { payed_value: _payed_value, ...updateData } = data;
      updateMutation.mutate({ id: selectedLoan.id, data: updateData });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredLoans = loans.filter(
    (loan) =>
      loan.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.benefited_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.creditor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return {
    loans,
    accounts,
    members,
    currentUserMemberId,
    isLoading,
    isDialogOpen,
    setIsDialogOpen,
    selectedLoan,
    isSubmitting,
    searchTerm,
    setSearchTerm,
    filteredLoans,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
  };
}

export { DEFAULT_FORM_DATA as LOAN_DEFAULT_FORM_DATA };
