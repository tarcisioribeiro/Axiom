import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatLocalDate } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { loansService } from '@/services/loans-service';
import { membersService } from '@/services/members-service';
import type { Loan, LoanFormData, Account, Member } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export interface UseLoansPageReturn {
  loans: Loan[];
  accounts: Account[];
  members: Member[];
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
  handleSubmit: (data: LoanFormData) => Promise<void>;
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
  const [loans, setLoans] = useState<Loan[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [loansData, accountsData, membersData] = await Promise.all([
        loansService.getAll(),
        accountsService.getAll(),
        membersService.getAll(),
      ]);
      setLoans(Array.isArray(loansData) ? loansData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setMembers(Array.isArray(membersData) ? membersData : []);
    } catch (error: unknown) {
      toast({ title: t('common.messages.loadError'), description: getErrorMessage(error), variant: 'destructive' });
      setLoans([]);
      setAccounts([]);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = () => {
    if (accounts.length === 0 || members.length === 0) {
      const missing = [];
      if (accounts.length === 0) missing.push('contas');
      if (members.length === 0) missing.push('membros');
      toast({
        title: t('common.messages.actionDenied'),
        description: t('pages.loans.noPrerequisitesMsg', { missing: missing.join(' e ') }),
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
    try {
      await loansService.delete(loan.id);
      toast({ title: t('pages.loans.deleted'), description: t('pages.loans.deletedDesc') });
      void loadData();
    } catch (error: unknown) {
      toast({ title: t('common.messages.deleteError'), description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleSubmit = async (data: LoanFormData) => {
    setIsSubmitting(true);
    try {
      if (selectedLoan) {
        const { payed_value: _payed_value, ...updateData } = data;
        await loansService.update(selectedLoan.id, updateData);
        toast({ title: t('pages.loans.updated'), description: 'O empréstimo foi atualizado com sucesso.' });
      } else {
        await loansService.create(data);
        toast({ title: t('pages.loans.created'), description: 'O empréstimo foi criado com sucesso.' });
      }
      setIsDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({ title: t('common.messages.saveError'), description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLoans = loans.filter(
    (loan) =>
      loan.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.benefited_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.creditor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return {
    loans, accounts, members, isLoading,
    isDialogOpen, setIsDialogOpen, selectedLoan, isSubmitting,
    searchTerm, setSearchTerm, filteredLoans,
    handleCreate, handleEdit, handleDelete, handleSubmit,
  };
}

export { DEFAULT_FORM_DATA as LOAN_DEFAULT_FORM_DATA };
