import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('pages.members.form.nameLabel')}</Label>
          <Input
            {...register('name', { required: true })}
            placeholder={t('pages.members.form.namePlaceholder')}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('pages.members.form.documentLabel')}</Label>
          <Input
            {...register('document', { required: true })}
            placeholder={t('pages.members.form.documentPlaceholder')}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('pages.members.form.phoneLabel')}</Label>
          <Input
            {...register('phone', { required: true })}
            placeholder={t('pages.members.form.phonePlaceholder')}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('pages.members.form.emailLabel')}</Label>
          <Input
            {...register('email')}
            type="email"
            placeholder={t('pages.members.form.emailPlaceholder')}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('pages.members.form.sexLabel')}</Label>
        <Select
          value={watch('sex')}
          onValueChange={(v) => setValue('sex', v)}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('common.actions.select')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="M">{t('pages.members.form.sexMale')}</SelectItem>
            <SelectItem value="F">{t('pages.members.form.sexFemale')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-6">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_creditor"
            checked={watch('is_creditor')}
            onCheckedChange={(checked) => setValue('is_creditor', checked as boolean)}
            disabled={isLoading}
          />
          <Label htmlFor="is_creditor" className="cursor-pointer">
            {t('pages.members.form.isCreditorLabel')}
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_benefited"
            checked={watch('is_benefited')}
            onCheckedChange={(checked) => setValue('is_benefited', checked as boolean)}
            disabled={isLoading}
          />
          <Label htmlFor="is_benefited" className="cursor-pointer">
            {t('pages.members.form.isBenefitedLabel')}
          </Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('pages.members.form.notesLabel')}</Label>
        <Textarea
          {...register('notes')}
          placeholder={t('pages.members.form.notesPlaceholder')}
          disabled={isLoading}
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
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
