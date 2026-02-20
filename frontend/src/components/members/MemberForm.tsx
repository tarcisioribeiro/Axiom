import { useForm } from 'react-hook-form';

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
          <Label>Nome *</Label>
          <Input
            {...register('name', { required: true })}
            placeholder="Ex: João Silva"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Documento (CPF/CNPJ) *</Label>
          <Input
            {...register('document', { required: true })}
            placeholder="Ex: 123.456.789-00"
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Telefone *</Label>
          <Input
            {...register('phone', { required: true })}
            placeholder="Ex: (11) 98765-4321"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            {...register('email')}
            type="email"
            placeholder="Ex: joao@email.com"
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Sexo *</Label>
        <Select
          value={watch('sex')}
          onValueChange={(v) => setValue('sex', v)}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="M">Masculino</SelectItem>
            <SelectItem value="F">Feminino</SelectItem>
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
            É Credor
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
            É Beneficiário
          </Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          {...register('notes')}
          placeholder="Observações adicionais..."
          disabled={isLoading}
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : member ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
};
