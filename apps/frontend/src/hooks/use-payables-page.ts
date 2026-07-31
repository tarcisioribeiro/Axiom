import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatLocalDate } from '@/lib/utils';
import { membersService } from '@/services/members-service';
import { payablesService } from '@/services/payables-service';
import type { Payable, PayableFormData, Member } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export interface UsePayablesPageReturn {
  payables: Payable[];
  currentUserMember: Member | null;
  isLoading: boolean;
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  selectedPayable: Payable | undefined;
  isSubmitting: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filteredPayables: Payable[];
  handleCreate: () => void;
  handleEdit: (payable: Payable) => void;
  handleDelete: (payable: Payable) => Promise<void>;
  handleSubmit: (data: PayableFormData) => Promise<void>;
}

export function usePayablesPage(): UsePayablesPageReturn {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState<Payable | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['payables'],
    queryFn: async () => {
      try {
        const [payablesData, memberData] = await Promise.all([
          payablesService.getAll(),
          membersService.getCurrentUserMember(),
        ]);
        return {
          payables: Array.isArray(payablesData) ? payablesData : [],
          currentUserMember: memberData,
        };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        return { payables: [] as Payable[], currentUserMember: null };
      }
    },
  });
  const payables = data?.payables ?? [];
  const currentUserMember = data?.currentUserMember ?? null;

  const handleCreate = () => {
    setSelectedPayable(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (payable: Payable) => {
    setSelectedPayable(payable);
    setIsDialogOpen(true);
  };

  const handleDelete = async (payable: Payable) => {
    const confirmed = await showConfirm({
      title: t('pages.payables.deleteTitle'),
      description: t('pages.payables.deleteDesc', { name: payable.description }),
    });
    if (!confirmed) return;
    try {
      await payablesService.delete(payable.id);
      toast({
        title: t('pages.payables.deleted'),
        description: t('pages.payables.deletedDesc'),
      });
      void queryClient.invalidateQueries({ queryKey: ['payables'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: PayableFormData) => {
    setIsSubmitting(true);
    try {
      const dataToSend = { ...data, member: currentUserMember?.id ?? null };
      if (selectedPayable) {
        await payablesService.update(selectedPayable.id, dataToSend);
        toast({
          title: t('pages.payables.updated'),
          description: t('pages.payables.updatedDesc'),
        });
      } else {
        await payablesService.create(dataToSend);
        toast({
          title: t('pages.payables.created'),
          description: t('pages.payables.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['payables'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPayables = payables.filter(
    (payable) =>
      payable.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payable.member_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return {
    payables,
    currentUserMember,
    isLoading,
    isDialogOpen,
    setIsDialogOpen,
    selectedPayable,
    isSubmitting,
    searchTerm,
    setSearchTerm,
    filteredPayables,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
  };
}

export function getPayableDefaultFormData(): PayableFormData {
  return {
    description: '',
    value: 0,
    paid_value: 0,
    date: formatLocalDate(new Date()),
    category: 'others',
    status: 'active',
  };
}
