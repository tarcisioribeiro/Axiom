import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { Pencil, Save, User, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { isValidCPF } from '@/lib/helpers';
import { formatPhone } from '@/lib/phone';
import { membersService } from '@/services/members-service';
import { getErrorMessage } from '@/utils/error-utils';

import { DocumentField } from './DocumentField';
import { Section } from './Section';

function PersonalDataForm({
  memberId,
  initialName,
  initialEmail,
  initialPhone,
  initialSex,
  initialBirthDate,
  initialDocument,
  onCancel,
}: {
  memberId: number;
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  initialSex: string;
  initialBirthDate: string | null;
  initialDocument: string;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(() => formatPhone(initialPhone));
  const [sex, setSex] = useState(initialSex);
  const [birthDate, setBirthDate] = useState(initialBirthDate);
  const [document, setDocument] = useState(initialDocument);
  const [editing, setEditing] = useState(false);

  const documentChanged = document !== initialDocument;

  const mutation = useMutation({
    mutationFn: () =>
      membersService.patch(memberId, {
        name: name.trim(),
        email: email || undefined,
        phone,
        sex,
        birth_date: birthDate,
        ...(documentChanged && { document }),
      }),
    onSuccess: () => {
      setEditing(false);
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

  // Erros só aparecem em modo de edição.
  const error = (invalid: boolean, key: string) =>
    editing && invalid ? t(`userProfile.personalData.${key}`) : undefined;
  const nameError = error(!name.trim(), 'nameRequired');
  const emailError = error(
    !!email && !z.email().safeParse(email).success,
    'emailInvalid'
  );
  const phoneError = error(!isValidPhoneNumber(phone), 'phoneInvalid');
  // O documento já salvo não é revalidado: só o que o usuário digitar.
  const documentError = error(
    documentChanged && !isValidCPF(document),
    'documentInvalid'
  );
  const birthDateError = error(
    !!birthDate && birthDate > format(new Date(), 'yyyy-MM-dd'),
    'birthDateFuture'
  );
  const hasErrors = [
    nameError,
    emailError,
    phoneError,
    documentError,
    birthDateError,
  ].some(Boolean);

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
        <FormField
          id="name"
          label={t('userProfile.personalData.name')}
          error={nameError}
        >
          <Input
            autoComplete="name"
            maxLength={200}
            disabled={!editing}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <div className="gap-md grid sm:grid-cols-2">
          <DocumentField
            value={document}
            onChange={setDocument}
            editing={editing}
            error={documentError}
          />
          <FormField
            id="email"
            label={t('userProfile.personalData.email')}
            error={emailError}
          >
            <Input
              type="email"
              autoComplete="email"
              disabled={!editing}
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
            />
          </FormField>
        </div>
        <FormField
          id="phone"
          label={t('userProfile.personalData.phone')}
          error={phoneError}
        >
          <Input
            type="tel"
            autoComplete="tel"
            placeholder="+55 (00) 00000-0000"
            disabled={!editing}
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value, phone))}
          />
        </FormField>
        <div className="gap-md grid sm:grid-cols-2">
          <div className="space-y-sm">
            <Label htmlFor="sex">{t('userProfile.personalData.sex')}</Label>
            <Select value={sex} onValueChange={setSex} disabled={!editing}>
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
              disabled={!editing}
            />
            {birthDateError && (
              <p className="animate-fade-in text-destructive text-sm" role="alert">
                {birthDateError}
              </p>
            )}
          </div>
        </div>
        <div className="gap-sm flex justify-end">
          {editing ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={onCancel}
              >
                <X />
                {t('common.actions.cancel')}
              </Button>
              <Button type="submit" loading={mutation.isPending} disabled={hasErrors}>
                {!mutation.isPending && <Save />}
                {mutation.isPending
                  ? t('userProfile.personalData.saving')
                  : t('userProfile.personalData.save')}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              <Pencil />
              {t('userProfile.personalData.edit')}
            </Button>
          )}
        </div>
      </form>
    </Section>
  );
}

export function PersonalDataSection({ memberId }: { memberId: number }) {
  // Cancelar remonta o formulário, descartando o que foi digitado.
  const [formKey, setFormKey] = useState(0);
  const { data: member } = useQuery({
    queryKey: ['members', 'me'],
    queryFn: () => membersService.getCurrentUserMember(),
  });

  if (!member) return null;

  return (
    <PersonalDataForm
      key={`${member.id}-${formKey}`}
      onCancel={() => setFormKey((k) => k + 1)}
      memberId={memberId}
      initialName={member.name ?? ''}
      initialEmail={member.email ?? ''}
      initialPhone={member.phone ?? ''}
      initialSex={member.sex}
      initialBirthDate={member.birth_date ?? null}
      initialDocument={(member.document ?? '').replace(/\D/g, '')}
    />
  );
}
