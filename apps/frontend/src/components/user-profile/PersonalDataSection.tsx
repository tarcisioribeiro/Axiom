import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Phone, User } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { membersService } from '@/services/members-service';
import { getErrorMessage } from '@/utils/error-utils';

import { Section } from './Section';

function PersonalDataForm({
  memberId,
  initialName,
  initialEmail,
  initialPhone,
}: {
  memberId: number;
  initialName: string;
  initialEmail: string;
  initialPhone: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);

  const mutation = useMutation({
    mutationFn: () =>
      membersService.patch(memberId, {
        name,
        email: email || undefined,
        phone,
      } as Parameters<typeof membersService.patch>[1]),
    onSuccess: () => {
      toast({ title: t('userProfile.personalData.success') });
      void queryClient.invalidateQueries({ queryKey: ['members', 'me'] });
    },
    onError: (err) => {
      toast({
        title: t('userProfile.personalData.error'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    },
  });

  return (
    <Section
      icon={<User className="h-4 w-4" />}
      title={t('userProfile.personalData.title')}
      description={t('userProfile.personalData.description')}
    >
      <div className="grid gap-md sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="name">{t('userProfile.personalData.name')}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-xs"
          />
        </div>
        <div>
          <Label htmlFor="email">{t('userProfile.personalData.email')}</Label>
          <div className="relative mt-xs">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="phone">{t('userProfile.personalData.phone')}</Label>
          <div className="relative mt-xs">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-sm">
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="gradient-primary font-semibold text-white"
        >
          {mutation.isPending
            ? t('userProfile.personalData.saving')
            : t('userProfile.personalData.save')}
        </Button>
      </div>
    </Section>
  );
}

export function PersonalDataSection({ memberId }: { memberId: number }) {
  const { data: member } = useQuery({
    queryKey: ['members', 'me'],
    queryFn: () => membersService.getCurrentUserMember(),
  });

  if (!member) return null;

  return (
    <PersonalDataForm
      key={member.id}
      memberId={memberId}
      initialName={member.name ?? ''}
      initialEmail={member.email ?? ''}
      initialPhone={member.phone ?? ''}
    />
  );
}
