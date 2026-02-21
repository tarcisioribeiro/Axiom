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
import { archiveSchema, type ArchiveFormData } from '@/lib/validations';
import { useAuthStore } from '@/stores/auth-store';
import type { Archive, Member } from '@/types';

const ARCHIVE_CATEGORIES = [
  { value: 'personal', label: 'Pessoal' },
  { value: 'financial', label: 'Financeiro' },
  { value: 'legal', label: 'Jurídico' },
  { value: 'medical', label: 'Médico' },
  { value: 'tax', label: 'Fiscal' },
  { value: 'work', label: 'Trabalho' },
  { value: 'other', label: 'Outro' },
];

const ARCHIVE_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Imagem' },
  { value: 'document', label: 'Documento' },
  { value: 'other', label: 'Outro' },
];

const FILE_TYPES_ACCEPT = [
  '.txt',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.json',
  '.xml',
  '.csv',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.svg',
  '.zip',
  '.rar',
  '.7z',
].join(',');

interface ArchiveFormProps {
  archive?: Archive;
  members?: Member[];
  onSubmit: (data: ArchiveFormData & { file?: File }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ArchiveForm({
  archive,
  onSubmit,
  onCancel,
  isLoading = false,
}: ArchiveFormProps) {
  const { user } = useAuthStore();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ArchiveFormData>({
    resolver: zodResolver(archiveSchema),
    defaultValues: archive
      ? {
          title: archive.title,
          category: archive.category as ArchiveFormData['category'],
          archive_type: archive.archive_type as ArchiveFormData['archive_type'],
          text_content: archive.text_content || '',
          notes: archive.notes || '',
          tags: archive.tags || '',
          owner: archive.owner,
        }
      : {
          title: '',
          category: 'personal' as const,
          archive_type: 'other' as const,
          text_content: '',
          notes: '',
          tags: '',
          owner: user?.id || 0,
        },
  });

  const handleFormSubmit = handleSubmit((data: ArchiveFormData) => {
    const fileInput = document.getElementById('file') as HTMLInputElement;
    const file = fileInput?.files?.[0];

    // Validação: para novos arquivos, deve ter arquivo OU conteúdo de texto
    if (!archive && !file && data.archive_type !== 'text') {
      alert('Por favor, selecione um arquivo.');
      return;
    }

    if (!archive && data.archive_type === 'text' && !data.text_content) {
      alert('Por favor, insira o conteúdo do texto.');
      return;
    }

    // Use logged-in user as owner for new archives
    const submitData: ArchiveFormData & { file?: File } = {
      ...data,
      owner: archive ? data.owner : user?.id || 0,
      file,
    };

    // Durante update, se text_content estiver vazio e o tipo não for 'text',
    // não enviar o campo para preservar conteúdo existente
    if (archive && !data.text_content && data.archive_type !== 'text') {
      delete submitData.text_content;
    }

    // Durante update de arquivo tipo texto, se text_content estiver vazio,
    // não enviar para preservar o conteúdo existente (exceto se usuário realmente quer limpar)
    if (
      archive &&
      data.archive_type === 'text' &&
      !data.text_content &&
      archive.archive_type === 'text'
    ) {
      // Avisar que não pode deixar vazio
      alert(
        'Arquivos de texto não podem ter conteúdo vazio. Se quiser remover o conteúdo, exclua o arquivo.'
      );
      return;
    }

    onSubmit(submitData);
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="title">Título *</Label>
          <Input
            id="title"
            {...register('title')}
            placeholder="Nome descritivo do arquivo"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="category">Categoria *</Label>
          <Select
            value={watch('category')}
            onValueChange={(value) =>
              setValue('category', value as ArchiveFormData['category'])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ARCHIVE_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="mt-1 text-sm text-destructive">{errors.category.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="archive_type">Tipo de Arquivo *</Label>
          <Select
            value={watch('archive_type')}
            onValueChange={(value) =>
              setValue('archive_type', value as ArchiveFormData['archive_type'])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ARCHIVE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.archive_type && (
            <p className="mt-1 text-sm text-destructive">
              {errors.archive_type.message}
            </p>
          )}
        </div>

        {watch('archive_type') === 'text' ? (
          <div className="col-span-2">
            <Label htmlFor="text_content">Conteúdo de Texto *</Label>
            <Textarea
              id="text_content"
              {...register('text_content')}
              placeholder="Digite ou cole o conteúdo do texto aqui..."
              rows={10}
              className="font-mono text-sm"
            />
            {errors.text_content && (
              <p className="mt-1 text-sm text-destructive">
                {errors.text_content.message}
              </p>
            )}
            <p className="mt-1 text-xs">
              O texto será criptografado antes de ser armazenado
            </p>
          </div>
        ) : (
          <div className="col-span-2">
            <Label htmlFor="file">Arquivo {!archive && '*'}</Label>
            <Input id="file" type="file" accept={FILE_TYPES_ACCEPT} />
            {archive ? (
              <p className="mt-1 text-xs text-warning">
                Deixe vazio para manter o arquivo atual. Upload de novo arquivo
                substituirá o existente.
              </p>
            ) : (
              <p className="mt-1 text-xs">
                O arquivo será criptografado antes de ser armazenado. Tipos suportados:
                PDF, Word, Excel, PowerPoint, JSON, XML, CSV, imagens, compactados, etc.
              </p>
            )}
          </div>
        )}

        <div className="col-span-2">
          <Label htmlFor="tags">Tags</Label>
          <Input id="tags" {...register('tags')} placeholder="tag1, tag2, tag3" />
          {errors.tags && (
            <p className="mt-1 text-sm text-destructive">{errors.tags.message}</p>
          )}
          <p className="mt-1 text-xs">Separe as tags com vírgulas</p>
        </div>

        <div className="col-span-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder="Notas adicionais sobre o arquivo..."
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
