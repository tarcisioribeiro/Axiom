/* eslint-disable react-hooks/incompatible-library */
import { format, parseISO } from 'date-fns';
import { Cake, FileText, Mail, Phone, Shield, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Member, MemberFormData } from '@/types';

import { RoleToggle } from './RoleToggle';

interface MemberFormProps {
  member?: Member;
  onSubmit: (data: MemberFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const MemberForm: React.FC<MemberFormProps> = ({
  member,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const { register, handleSubmit, setValue, watch } = useForm<MemberFormData>({
    defaultValues: member
      ? {
          name: member.name,
          document: member.document,
          phone: member.phone,
          email: member.email || '',
          sex: member.sex,
          is_creditor: member.is_creditor,
          is_benefited: member.is_benefited,
          birth_date: member.birth_date || undefined,
          notes: member.notes || '',
        }
      : {
          sex: 'M',
          is_creditor: true,
          is_benefited: true,
        },
  });

  const watchedSex = watch('sex');
  const watchedBirthDate = watch('birth_date');
  const watchedIsCreditor = watch('is_creditor');
  const watchedIsBenefited = watch('is_benefited');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-lg">
      {/* Seção: Identificação Pessoal */}
      <FormSection title={t('common.form.sections.basicInfo')} icon={User}>
        <div className="gap-md grid grid-cols-1 md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="name" className="gap-xs flex items-center">
              <User className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.members.form.nameLabel')}
            </Label>
            <Input
              id="name"
              {...register('name', { required: true })}
              placeholder={t('pages.members.form.namePlaceholder')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label htmlFor="document" className="gap-xs flex items-center">
              <FileText className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.members.form.documentLabel')}
            </Label>
            <Input
              id="document"
              {...register('document', { required: true })}
              placeholder={t('pages.members.form.documentPlaceholder')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <User className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.members.form.sexLabel')}
            </Label>
            <div className="border-border/70 bg-muted/30 flex rounded-md border p-0.5">
              {(['M', 'F'] as const).map((sex) => (
                <button
                  key={sex}
                  type="button"
                  onClick={() => setValue('sex', sex)}
                  disabled={isLoading}
                  className={`gap-xs flex flex-1 items-center justify-center rounded px-3 py-1.5 text-sm font-medium transition duration-150 ${
                    watchedSex === sex
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {sex === 'M' ? '♂' : '♀'}{' '}
                  {sex === 'M'
                    ? t('pages.members.form.sexMale')
                    : t('pages.members.form.sexFemale')}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-sm">
            <Label htmlFor="phone" className="gap-xs flex items-center">
              <Phone className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.members.form.phoneLabel')}
            </Label>
            <Input
              id="phone"
              {...register('phone', { required: true })}
              placeholder={t('pages.members.form.phonePlaceholder')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label htmlFor="email" className="gap-xs flex items-center">
              <Mail className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.members.form.emailLabel')}
            </Label>
            <Input
              id="email"
              {...register('email')}
              type="email"
              placeholder={t('pages.members.form.emailPlaceholder')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <Cake className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.members.form.birthDateLabel')}
            </Label>
            <DatePicker
              value={
                watchedBirthDate ? parseISO(watchedBirthDate + 'T00:00:00') : undefined
              }
              onChange={(d) =>
                setValue('birth_date', d ? format(d, 'yyyy-MM-dd') : null)
              }
              disabled={isLoading}
              maxDate={new Date()}
            />
          </div>
        </div>
      </FormSection>

      {/* Seção: Permissões & Papel */}
      <FormSection title={t('common.form.sections.paymentConfig')} icon={Shield}>
        <div className="gap-sm grid grid-cols-1 md:grid-cols-2">
          <RoleToggle
            checked={!!watchedIsCreditor}
            disabled={isLoading}
            onToggle={() => setValue('is_creditor', !watchedIsCreditor)}
            tone="primary"
            icon={Shield}
            title={t('pages.members.form.isCreditor')}
            subtitle={t('pages.members.stats.creditorsSubtitle')}
          />
          <RoleToggle
            checked={!!watchedIsBenefited}
            disabled={isLoading}
            onToggle={() => setValue('is_benefited', !watchedIsBenefited)}
            tone="success"
            icon={User}
            title={t('pages.members.form.isBenefited')}
            subtitle={t('pages.members.stats.beneficiariesSubtitle')}
          />
        </div>

        <div className="space-y-sm">
          <Label htmlFor="notes" className="gap-xs flex items-center">
            <FileText className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.members.form.notesLabel')}
          </Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder={t('pages.members.form.notesPlaceholder')}
            disabled={isLoading}
            rows={3}
          />
        </div>
      </FormSection>

      <div className="gap-sm pt-md flex justify-end border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? t('common.actions.saving')
            : member
              ? t('common.actions.update')
              : t('common.actions.create')}
        </Button>
      </div>
    </form>
  );
};
