import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { Eye, EyeOff, Save, User } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlainButton } from '@/components/ui/plain-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatDocument } from '@/lib/formatters';
import { formatPhone } from '@/lib/phone';
import { membersService } from '@/services/members-service';
import { getErrorMessage } from '@/utils/error-utils';

import { Section } from './Section';

function PersonalDataForm({
  memberId,
  initialName,
  initialEmail,
  initialPhone,
  initialSex,
  initialBirthDate,
  document,
}: {
  memberId: number;
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  initialSex: string;
  initialBirthDate: string | null;
  document: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(() => formatPhone(initialPhone));
  const [sex, setSex] = useState(initialSex);
  const [birthDate, setBirthDate] = useState(initialBirthDate);
  const [showDocument, setShowDocument] = useState(false);

  const formattedDocument = formatDocument(document);
  // Mascarado: só os dois últimos caracteres ficam visíveis.
  const maskedDocument =
    formattedDocument.slice(0, -2).replace(/[^.\-/]/g, '*') +
    formattedDocument.slice(-2);

  const mutation = useMutation({
    mutationFn: () =>
      membersService.patch(memberId, {
        name,
        email: email || undefined,
        phone,
        sex,
        birth_date: birthDate,
      }),
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

  const emailError =
    email && !z.email().safeParse(email).success
      ? t('userProfile.personalData.emailInvalid')
      : undefined;
  const phoneError = isValidPhoneNumber(phone)
    ? undefined
    : t('userProfile.personalData.phoneInvalid');

  return (
    <Section
      icon={<User className="h-4 w-4" />}
      title={t('userProfile.personalData.title')}
    >
      <form
        className="space-y-md"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <FormField id="name" label={t('userProfile.personalData.name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <div className="space-y-sm">
          <Label htmlFor="document">{t('userProfile.personalData.document')}</Label>
          <div className="relative">
            <Input
              id="document"
              readOnly
              value={showDocument ? formattedDocument : maskedDocument}
              className="bg-muted/40 text-muted-foreground pr-9"
            />
            <PlainButton
              aria-label={t(
                showDocument
                  ? 'userProfile.personalData.hideDocument'
                  : 'userProfile.personalData.showDocument'
              )}
              type="button"
              onClick={() => setShowDocument((v) => !v)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
            >
              {showDocument ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </PlainButton>
          </div>
        </div>
        <FormField
          id="email"
          label={t('userProfile.personalData.email')}
          error={emailError}
        >
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
          />
        </FormField>
        <FormField
          id="phone"
          label={t('userProfile.personalData.phone')}
          error={phoneError}
        >
          <Input
            type="tel"
            autoComplete="tel"
            placeholder="+55 (00) 00000-0000"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value, phone))}
          />
        </FormField>
        <div className="gap-md grid sm:grid-cols-2">
          <div className="space-y-sm">
            <Label htmlFor="sex">{t('userProfile.personalData.sex')}</Label>
            <Select value={sex} onValueChange={setSex}>
              <SelectTrigger id="sex">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">{t('pages.members.form.sexMale')}</SelectItem>
                <SelectItem value="F">{t('pages.members.form.sexFemale')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-sm">
            <Label>{t('userProfile.personalData.birthDate')}</Label>
            <DatePicker
              value={birthDate ? parseISO(birthDate + 'T00:00:00') : undefined}
              onChange={(d) => setBirthDate(d ? format(d, 'yyyy-MM-dd') : null)}
              maxDate={new Date()}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            loading={mutation.isPending}
            disabled={!name.trim() || !!emailError || !!phoneError}
          >
            {!mutation.isPending && <Save />}
            {mutation.isPending
              ? t('userProfile.personalData.saving')
              : t('userProfile.personalData.save')}
          </Button>
        </div>
      </form>
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
      initialSex={member.sex}
      initialBirthDate={member.birth_date ?? null}
      document={member.document ?? ''}
    />
  );
}
