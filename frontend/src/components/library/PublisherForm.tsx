import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
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
import { publisherSchema, type PublisherFormData } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import { COUNTRIES } from '@/types';
import type { Publisher } from '@/types';

interface PublisherFormProps {
  publisher?: Publisher;
  onSubmit: (data: PublisherFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PublisherForm({
  publisher,
  onSubmit,
  onCancel,
  isLoading = false,
}: PublisherFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PublisherFormData>({
    resolver: zodResolver(publisherSchema),
    defaultValues: publisher
      ? {
          name: publisher.name,
          description: publisher.description || '',
          website: publisher.website || '',
          country: publisher.country || 'Brazil',
          founded_year: publisher.founded_year,
          owner: publisher.owner,
        }
      : {
          name: '',
          description: '',
          website: '',
          country: 'Brazil',
          founded_year: undefined,
          owner: 0,
        },
  });

  // Load current user member when creating new publisher
  useEffect(() => {
    const loadCurrentUserMember = async () => {
      if (!publisher) {
        try {
          const member = await membersService.getCurrentUserMember();
          setValue('owner', member.id);
        } catch (error) {
          console.error('Erro ao carregar membro do usuário:', error);
        }
      }
    };

    void loadCurrentUserMember();
  }, [publisher, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input id="name" {...register('name')} placeholder="Nome da editora" />
          {errors.name && (
            <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">País *</Label>
          <Select
            value={watch('country')}
            onValueChange={(value) => setValue('country', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((country) => (
                <SelectItem key={country.value} value={country.value}>
                  {country.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.country && (
            <p className="mt-1 text-sm text-destructive">{errors.country.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            type="url"
            {...register('website')}
            placeholder="https://exemplo.com.br"
          />
          {errors.website && (
            <p className="mt-1 text-sm text-destructive">{errors.website.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="founded_year">Ano de Fundação</Label>
          <Input
            id="founded_year"
            type="number"
            min="1000"
            max={new Date().getFullYear()}
            {...register('founded_year', {
              setValueAs: (value: string) => (value === '' ? undefined : parseInt(value)),
            })}
          />
          {errors.founded_year && (
            <p className="mt-1 text-sm text-destructive">
              {errors.founded_year.message}
            </p>
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
