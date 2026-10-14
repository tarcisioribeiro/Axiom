import { Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { Member } from '@/types';

interface Props {
  member: Member | null;
  roles: string;
  onClose: () => void;
}

export function MemberDetailModal({ member: selected, roles, onClose }: Props) {
  const { t } = useTranslation();
  // Mantém o último membro para o modal sair inteiro na animação de fechamento.
  const [member, setMember] = useState(selected);
  if (selected && selected !== member) setMember(selected);

  if (!member) return null;

  const fields = [
    { label: t('pages.members.detailLabels.roles'), value: roles },
    { label: t('pages.members.detailLabels.phone'), value: member.phone || '—' },
    { label: t('pages.members.detailLabels.email'), value: member.email || '—' },
    { label: t('pages.members.detailLabels.document'), value: member.document || '—' },
    {
      label: t('pages.members.detailLabels.income'),
      value: member.monthly_income
        ? formatCurrency(parseFloat(member.monthly_income))
        : '—',
    },
    {
      label: t('pages.members.detailLabels.createdAt'),
      value: formatDate(member.created_at),
    },
  ];

  return (
    <Dialog open={!!selected} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle icon={Users}>{member.name}</DialogTitle>
          <DialogDescription>{member.name}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Badge variant={member.active ? 'success' : 'outline'}>
            {member.active ? t('common.status.active') : t('common.status.inactive')}
          </Badge>
        </div>

        <div className="gap-md grid grid-cols-2">
          {fields.map((f) => (
            <div key={f.label} className="min-w-0">
              <p className="text-muted-foreground text-xs">{f.label}</p>
              <p className="truncate font-semibold" title={f.value}>
                {f.value}
              </p>
            </div>
          ))}
        </div>

        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}
