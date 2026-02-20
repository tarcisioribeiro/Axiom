import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { authorSchema } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import { NATIONALITIES, ERAS } from '@/types';
import type { Author, AuthorFormData } from '@/types';

interface AuthorFormProps {
  author?: Author;
  onSubmit: (data: AuthorFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AuthorForm({
  author,
  onSubmit,
  onCancel,
  isLoading = false,
}: AuthorFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AuthorFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    resolver: zodResolver(authorSchema) as any,
    defaultValues: author
      ? {
          name: author.name,
          birth_year: author.birth_year ?? undefined,
          birth_era: author.birth_era || 'DC',
          death_year: author.death_year ?? undefined,
          death_era: author.death_era ?? undefined,
          nationality: author.nationality || 'BRA',
          biography: author.biography || '',
          owner: author.owner,
        }
      : {
          name: '',
          birth_year: undefined,
          birth_era: 'DC',
          death_year: undefined,
          death_era: undefined,
          nationality: 'BRA',
          biography: '',
          owner: 0,
        },
  });

  // Load current user member when creating new author
  useEffect(() => {
    const loadCurrentUserMember = async () => {
      if (!author) {
        try {
          const member = await membersService.getCurrentUserMember();
          setValue('owner', member.id);
        } catch (error) {
          console.error('Erro ao carregar membro do usuário:', error);
        }
      }
    };

    void loadCurrentUserMember();
  }, [author, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input id="name" {...register('name')} placeholder="Nome completo do autor" />
          {errors.name && (
            <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="birth_year">Ano de Nascimento</Label>
            <Input
              id="birth_year"
              type="number"
              {...register('birth_year', { valueAsNumber: true })}
              placeholder="Ex: 384"
            />
            {errors.birth_year && (
              <p className="mt-1 text-sm text-destructive">
                {errors.birth_year.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="birth_era">Era (Nascimento)</Label>
            <Select
              value={watch('birth_era')}
              onValueChange={(value) => setValue('birth_era', value as 'AC' | 'DC')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a era" />
              </SelectTrigger>
              <SelectContent>
                {ERAS.map((era) => (
                  <SelectItem key={era.value} value={era.value}>
                    {era.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.birth_era && (
              <p className="mt-1 text-sm text-destructive">
                {errors.birth_era.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="death_year">Ano de Falecimento</Label>
            <Input
              id="death_year"
              type="number"
              {...register('death_year', { valueAsNumber: true })}
              placeholder="Ex: 322 (opcional)"
            />
            {errors.death_year && (
              <p className="mt-1 text-sm text-destructive">
                {errors.death_year.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="death_era">Era (Falecimento)</Label>
            <Select
              value={watch('death_era') || ''}
              onValueChange={(value) =>
                setValue('death_era', (value as 'AC' | 'DC' | undefined) || undefined)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a era (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {ERAS.map((era) => (
                  <SelectItem key={era.value} value={era.value}>
                    {era.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.death_era && (
              <p className="mt-1 text-sm text-destructive">
                {errors.death_era.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nationality">Nacionalidade *</Label>
          <Select
            value={watch('nationality')}
            onValueChange={(value) => setValue('nationality', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NATIONALITIES.map((nat) => (
                <SelectItem key={nat.value} value={nat.value}>
                  {nat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.nationality && (
            <p className="mt-1 text-sm text-destructive">
              {errors.nationality.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="biography">Biografia</Label>
          <Textarea
            id="biography"
            {...register('biography')}
            placeholder="Informações sobre o autor..."
            rows={4}
          />
          {errors.biography && (
            <p className="mt-1 text-sm text-destructive">{errors.biography.message}</p>
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
