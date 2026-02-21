import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
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
import { storedCardSchema, type StoredCreditCardFormData } from '@/lib/validations';
import type { StoredCreditCard, CreditCard, Member } from '@/types';

const CARD_FLAGS = [
  { value: 'MSC', label: 'Mastercard' },
  { value: 'VSA', label: 'Visa' },
  { value: 'ELO', label: 'Elo' },
  { value: 'EXP', label: 'American Express' },
  { value: 'HCD', label: 'Hipercard' },
  { value: 'DIN', label: 'Diners Club' },
  { value: 'OTHER', label: 'Outro' },
];

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1).padStart(2, '0'),
}));

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 20 }, (_, i) => ({
  value: currentYear + i,
  label: String(currentYear + i),
}));

interface StoredCardFormProps {
  card?: StoredCreditCard;
  creditCards?: CreditCard[];
  currentMember: Member | null;
  onSubmit: (data: StoredCreditCardFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function StoredCardForm({
  card,
  creditCards = [],
  currentMember,
  onSubmit,
  onCancel,
  isLoading = false,
}: StoredCardFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StoredCreditCardFormData>({
    resolver: zodResolver(storedCardSchema),
    defaultValues: card
      ? {
          name: card.name,
          card_number: '', // Não carregar dados sensíveis por segurança
          security_code: '',
          cardholder_name: card.cardholder_name,
          expiration_month: card.expiration_month,
          expiration_year: card.expiration_year,
          flag: card.flag as StoredCreditCardFormData['flag'],
          notes: card.notes || '',
          owner: card.owner,
          finance_card: card.finance_card || undefined,
        }
      : {
          name: '',
          card_number: '',
          security_code: '',
          cardholder_name: '',
          expiration_month: 1,
          expiration_year: currentYear,
          flag: 'VSA',
          notes: '',
          owner: currentMember?.id || 0,
          finance_card: undefined,
        },
  });

  const formatCardNumber = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 16);
  };

  const formatCVV = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 4);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Nome do Cartão *</Label>
          <Input id="name" {...register('name')} placeholder="Ex: Cartão Pessoal" />
          {errors.name && (
            <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="card_number">Número do Cartão *</Label>
          <Input
            id="card_number"
            {...register('card_number')}
            placeholder="1234567890123456"
            maxLength={16}
            onChange={(e) => {
              const formatted = formatCardNumber(e.target.value);
              setValue('card_number', formatted);
            }}
          />
          {errors.card_number && (
            <p className="mt-1 text-sm text-destructive">
              {errors.card_number.message}
            </p>
          )}
          {!card && <p className="mt-1 text-xs">16 dígitos sem espaços ou hífens</p>}
          {card && (
            <p className="mt-1 text-xs text-warning">
              Deixe vazio para manter o número atual (criptografado)
            </p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="cardholder_name">Nome do Titular *</Label>
          <Input
            id="cardholder_name"
            {...register('cardholder_name')}
            placeholder="Nome como está no cartão"
          />
          {errors.cardholder_name && (
            <p className="mt-1 text-sm text-destructive">
              {errors.cardholder_name.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="security_code">CVV *</Label>
          <Input
            id="security_code"
            {...register('security_code')}
            placeholder="123"
            maxLength={4}
            onChange={(e) => {
              const formatted = formatCVV(e.target.value);
              setValue('security_code', formatted);
            }}
          />
          {errors.security_code && (
            <p className="mt-1 text-sm text-destructive">
              {errors.security_code.message}
            </p>
          )}
          {card && (
            <p className="mt-1 text-xs text-warning">
              Deixe vazio para manter o CVV atual
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="flag">Bandeira *</Label>
          <Select
            value={watch('flag')}
            onValueChange={(value) =>
              setValue('flag', value as StoredCreditCardFormData['flag'])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CARD_FLAGS.map((flag) => (
                <SelectItem key={flag.value} value={flag.value}>
                  {flag.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.flag && (
            <p className="mt-1 text-sm text-destructive">{errors.flag.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="expiration_month">Mês de Validade *</Label>
          <Select
            value={watch('expiration_month')?.toString()}
            onValueChange={(value) => setValue('expiration_month', parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month) => (
                <SelectItem key={month.value} value={month.value.toString()}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.expiration_month && (
            <p className="mt-1 text-sm text-destructive">
              {errors.expiration_month.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="expiration_year">Ano de Validade *</Label>
          <Select
            value={watch('expiration_year')?.toString()}
            onValueChange={(value) => setValue('expiration_year', parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((year) => (
                <SelectItem key={year.value} value={year.value.toString()}>
                  {year.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.expiration_year && (
            <p className="mt-1 text-sm text-destructive">
              {errors.expiration_year.message}
            </p>
          )}
        </div>

        {creditCards.length > 0 && (
          <div className="col-span-2">
            <Label htmlFor="finance_card">Cartão Financeiro Vinculado (Opcional)</Label>
            <Select
              value={watch('finance_card')?.toString() || 'none'}
              onValueChange={(value) =>
                setValue('finance_card', value === 'none' ? undefined : parseInt(value))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {creditCards.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id.toString()}>
                    {cc.name} - {cc.on_card_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs">
              Vincule este cartão armazenado a um cartão do módulo financeiro
            </p>
          </div>
        )}

        <div className="col-span-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder="Notas adicionais sobre o cartão..."
            rows={3}
          />
          {errors.notes && (
            <p className="mt-1 text-sm text-destructive">{errors.notes.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar'
          )}
        </Button>
      </div>
    </form>
  );
}
