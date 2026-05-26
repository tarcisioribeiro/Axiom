/* eslint-disable react-hooks/incompatible-library */
import { Check, FileText, Mail, Phone, Shield, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Member, MemberFormData } from '@/types';

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
          notes: member.notes || '',
        }
      : {
          sex: 'M',
          is_creditor: true,
          is_benefited: true,
        },
  });

  const watchedSex = watch('sex');
  const watchedIsCreditor = watch('is_creditor');
  const watchedIsBenefited = watch('is_benefited');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-lg">
      {/* Seção: Identificação Pessoal */}
      <FormSection title={t('common.form.sections.basicInfo')} icon={User}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="name" className="flex items-center gap-xs">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
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
            <Label htmlFor="document" className="flex items-center gap-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
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
            <Label className="flex items-center gap-xs">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.members.form.sexLabel')}
            </Label>
            <div className="flex rounded-md border border-border/70 bg-muted/30 p-0.5">
              {(['M', 'F'] as const).map((sex) => (
                <button
                  key={sex}
                  type="button"
                  onClick={() => setValue('sex', sex)}
                  disabled={isLoading}
                  className={`flex flex-1 items-center justify-center gap-xs rounded px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
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
            <Label htmlFor="phone" className="flex items-center gap-xs">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
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
            <Label htmlFor="email" className="flex items-center gap-xs">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
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
        </div>
      </FormSection>

      {/* Seção: Permissões & Papel */}
      <FormSection title={t('common.form.sections.paymentConfig')} icon={Shield}>
        <div className="grid grid-cols-1 gap-sm md:grid-cols-2">
          <div
            role="button"
            tabIndex={isLoading ? -1 : 0}
            onClick={() => !isLoading && setValue('is_creditor', !watchedIsCreditor)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !isLoading)
                setValue('is_creditor', !watchedIsCreditor);
            }}
            className={`flex cursor-pointer items-start gap-sm rounded-lg border p-sm text-left transition-all ${
              watchedIsCreditor
                ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                : 'border-border/60 bg-muted/20 opacity-70'
            } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
          >
            <div
              className={`mt-0.5 rounded-full p-1 ${watchedIsCreditor ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
            >
              <Shield className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t('pages.members.form.isCreditor')}
                </span>
                <div
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary shadow',
                    watchedIsCreditor
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background',
                    isLoading && 'opacity-50'
                  )}
                >
                  {watchedIsCreditor && <Check className="h-3 w-3" />}
                </div>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('pages.members.stats.creditorsSubtitle')}
              </p>
            </div>
          </div>

          <div
            role="button"
            tabIndex={isLoading ? -1 : 0}
            onClick={() => !isLoading && setValue('is_benefited', !watchedIsBenefited)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !isLoading)
                setValue('is_benefited', !watchedIsBenefited);
            }}
            className={`flex cursor-pointer items-start gap-sm rounded-lg border p-sm text-left transition-all ${
              watchedIsBenefited
                ? 'border-success/50 bg-success/5 ring-1 ring-success/20'
                : 'border-border/60 bg-muted/20 opacity-70'
            } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
          >
            <div
              className={`mt-0.5 rounded-full p-1 ${watchedIsBenefited ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
            >
              <User className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t('pages.members.form.isBenefited')}
                </span>
                <div
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary shadow',
                    watchedIsBenefited
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background',
                    isLoading && 'opacity-50'
                  )}
                >
                  {watchedIsBenefited && <Check className="h-3 w-3" />}
                </div>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('pages.members.stats.beneficiariesSubtitle')}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-sm">
          <Label htmlFor="notes" className="flex items-center gap-xs">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
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

      <div className="flex justify-end gap-sm border-t pt-md">
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
