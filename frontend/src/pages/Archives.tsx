import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Download,
  FileText,
  File,
  Archive as ArchiveIcon,
  Calendar,
  Tag,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { ArchiveForm } from '@/components/security/ArchiveForm';
import { VaultGuard } from '@/components/security/VaultGuard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { archivesService } from '@/services/archives-service';
import { membersService } from '@/services/members-service';
import type { Archive, ArchiveFormData, Member } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const ARCHIVE_CATEGORIES: Record<string, string> = {
  personal: 'Pessoal',
  financial: 'Financeiro',
  legal: 'Jurídico',
  medical: 'Médico',
  tax: 'Fiscal',
  work: 'Trabalho',
  other: 'Outro',
};

const ARCHIVE_TYPES: Record<string, string> = {
  text: 'Texto',
  pdf: 'PDF',
  image: 'Imagem',
  document: 'Documento',
  other: 'Outro',
};

export default function Archives() {
  const [archives, setArchives] = useState<Archive[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isContentDialogOpen, setIsContentDialogOpen] = useState(false);
  const [selectedArchive, setSelectedArchive] = useState<Archive | undefined>();
  const [revealedContent, setRevealedContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [archivesData, membersData] = await Promise.all([
        archivesService.getAll(),
        membersService.getAll(),
      ]);
      setArchives(archivesData);
      setMembers(membersData);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar dados',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedArchive(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = async (archive: Archive) => {
    // Se for arquivo de texto, carregar o conteúdo descriptografado
    if (archive.archive_type === 'text' && archive.has_text) {
      try {
        const data = await archivesService.reveal(archive.id);
        if (data.error) {
          toast({
            title: 'Erro ao carregar conteúdo',
            description: data.error,
            variant: 'destructive',
          });
          setSelectedArchive(archive);
        } else {
          setSelectedArchive({
            ...archive,
            text_content: data.text_content ?? undefined,
          });
        }
      } catch (error: unknown) {
        toast({
          title: 'Erro ao carregar conteúdo',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        setSelectedArchive(archive);
      }
    } else {
      setSelectedArchive(archive);
    }
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir arquivo',
      description:
        'Tem certeza que deseja excluir este arquivo confidencial? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await archivesService.delete(id);
      toast({
        title: 'Arquivo excluído',
        description: 'O arquivo foi excluído com sucesso.',
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleRevealContent = async (archive: Archive) => {
    if (archive.archive_type !== 'text') {
      toast({
        title: 'Ação não disponível',
        description: 'Apenas arquivos de texto podem ser visualizados diretamente.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsRevealing(true);
      setSelectedArchive(archive);
      const data = await archivesService.reveal(archive.id);

      if (data.error) {
        const title =
          data.error_type === 'decryption_failed'
            ? 'Erro de descriptografia'
            : 'Conteúdo indisponível';
        toast({
          title,
          description: data.error,
          variant: 'destructive',
        });
        return;
      }

      if (data.text_content == null) {
        toast({
          title: 'Conteúdo vazio',
          description: 'Este arquivo não possui conteúdo de texto armazenado.',
          variant: 'destructive',
        });
        return;
      }

      setRevealedContent(data.text_content);
      setIsContentDialogOpen(true);
      toast({
        title: 'Conteúdo revelado',
        description: 'O conteúdo do arquivo foi descriptografado com sucesso.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao revelar conteúdo',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsRevealing(false);
    }
  };

  const handleDownload = async (archive: Archive) => {
    if (archive.archive_type === 'text') {
      // Para texto, revelar conteúdo ao invés de download
      void handleRevealContent(archive);
      return;
    }

    try {
      const blob = await archivesService.download(archive.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = archive.file_name || `${archive.title}.bin`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({
        title: 'Download iniciado',
        description: 'O arquivo está sendo baixado.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao baixar arquivo',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: ArchiveFormData & { file?: File }) => {
    try {
      setIsSubmitting(true);
      if (selectedArchive) {
        await archivesService.update(selectedArchive.id, data);
        toast({
          title: 'Arquivo atualizado',
          description: 'O arquivo foi atualizado com sucesso.',
        });
      } else {
        await archivesService.create(data);
        toast({
          title: 'Arquivo criado',
          description: 'O arquivo foi criado e criptografado com sucesso.',
        });
      }
      setIsDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao salvar',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredArchives = archives.filter(
    (arc) =>
      arc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (arc.tags?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (arc.file_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <VaultGuard>
    <PageContainer>
      <PageHeader
        title="Arquivos Confidenciais"
        icon={<ArchiveIcon />}
        action={{
          label: 'Novo Arquivo',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex gap-4">
        <Input
          placeholder="Buscar arquivos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {filteredArchives.length === 0 ? (
        <EmptyState
          icon={<ArchiveIcon className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm
              ? 'Nenhum arquivo encontrado para a pesquisa atual.'
              : 'Nenhum arquivo cadastrado. Clique em "Novo Arquivo" para começar.'
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredArchives.map((arc) => (
            <Card key={arc.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      {arc.archive_type === 'text' ? (
                        <FileText className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        <File className="h-4 w-4 flex-shrink-0" />
                      )}
                      <CardTitle className="truncate text-base">{arc.title}</CardTitle>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{ARCHIVE_CATEGORIES[arc.category]}</Badge>
                      <Badge variant="outline">{ARCHIVE_TYPES[arc.archive_type]}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        arc.archive_type === 'text'
                          ? handleRevealContent(arc)
                          : handleDownload(arc)
                      }
                      disabled={isRevealing}
                      aria-label={arc.archive_type === 'text' ? 'Ver conteúdo' : 'Baixar arquivo'}
                    >
                      {arc.archive_type === 'text' ? (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Download className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(arc)} aria-label="Editar">
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(arc.id)} aria-label="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(arc.created_at, 'dd/MM/yyyy')}</span>
                  </div>
                  <span>{formatFileSize(arc.file_size)}</span>
                </div>
                {arc.tags && (
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 flex-shrink-0" />
                    <div className="flex flex-wrap gap-1">
                      {arc.tags
                        .split(',')
                        .slice(0, 3)
                        .map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {tag.trim()}
                          </Badge>
                        ))}
                      {arc.tags.split(',').length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{arc.tags.split(',').length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para criar/editar arquivo */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedArchive ? 'Editar' : 'Novo'} Arquivo Confidencial
            </DialogTitle>
            <DialogDescription>
              {selectedArchive
                ? 'Atualize as informações do arquivo'
                : 'Adicione um novo arquivo ao cofre criptografado'}
            </DialogDescription>
          </DialogHeader>
          <ArchiveForm
            archive={selectedArchive}
            members={members}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog para visualizar conteúdo de texto */}
      <Dialog open={isContentDialogOpen} onOpenChange={setIsContentDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedArchive?.title}</DialogTitle>
            <DialogDescription>
              Conteúdo descriptografado -{' '}
              {ARCHIVE_CATEGORIES[selectedArchive?.category || 'other']}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={revealedContent}
              readOnly
              rows={20}
              className="font-mono text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(revealedContent);
                  toast({
                    title: 'Copiado!',
                    description: 'Conteúdo copiado para a área de transferência.',
                  });
                }}
              >
                Copiar
              </Button>
              <Button onClick={() => setIsContentDialogOpen(false)}>Fechar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
    </VaultGuard>
  );
}
