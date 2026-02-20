import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/common/SearchInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { summariesService } from '@/services/summaries-service';
import { booksService } from '@/services/books-service';
import type { Summary, SummaryFormData, Book } from '@/types';
import {
  Plus,
  Edit,
  Trash2,
  FileText,
  BookOpen,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageContainer } from '@/components/common/PageContainer';

export default function Summaries() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);
  const { showConfirm } = useAlertDialog();
  const [formData, setFormData] = useState<SummaryFormData>({
    title: '',
    book: 0,
    text: '',
    owner: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summariesData, booksData] = await Promise.all([
        summariesService.getAll(),
        booksService.getAll(),
      ]);
      setSummaries(summariesData);
      setBooks(booksData);
    } catch {
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os resumos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await summariesService.create(formData);
      toast({
        title: 'Resumo criado',
        description: 'O resumo foi criado com sucesso.',
      });
      setIsCreateDialogOpen(false);
      setFormData({
        title: '',
        book: 0,
        text: '',
        owner: 0,
      });
      void loadData();
    } catch {
      toast({
        title: 'Erro ao criar resumo',
        description: 'Não foi possível criar o resumo.',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSummary) return;

    try {
      await summariesService.update(selectedSummary.id, formData);
      toast({
        title: 'Resumo atualizado',
        description: 'O resumo foi atualizado com sucesso.',
      });
      setIsEditDialogOpen(false);
      setSelectedSummary(null);
      setFormData({
        title: '',
        book: 0,
        text: '',
        owner: 0,
      });
      void loadData();
    } catch {
      toast({
        title: 'Erro ao atualizar resumo',
        description: 'Não foi possível atualizar o resumo.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir resumo',
      description:
        'Tem certeza que deseja excluir este resumo? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await summariesService.delete(id);
      toast({
        title: 'Resumo excluído',
        description: 'O resumo foi excluído com sucesso.',
      });
      void loadData();
    } catch {
      toast({
        title: 'Erro ao excluir resumo',
        description: 'Não foi possível excluir o resumo.',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (summary: Summary) => {
    setSelectedSummary(summary);
    setFormData({
      title: summary.title,
      book: summary.book,
      text: summary.text,
      owner: summary.owner,
    });
    setIsEditDialogOpen(true);
  };

  const filteredSummaries = summaries.filter(
    (summary) =>
      summary.book_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateClick = () => {
    const readBooks = books.filter((book) => book.read_status === 'read');
    if (readBooks.length === 0) {
      toast({
        title: 'Ação não permitida',
        description:
          'É necessário ter pelo menos um livro completamente lido antes de criar um resumo.',
        variant: 'destructive',
      });
      return;
    }
    setIsCreateDialogOpen(true);
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Resumos"
        icon={<FileText />}
        action={{
          label: 'Novo Resumo',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreateClick,
        }}
      />

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Criar Novo Resumo</DialogTitle>
              <DialogDescription>Adicione um resumo para um livro.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="book">Livro *</Label>
                <Select
                  value={formData.book.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, book: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um livro" />
                  </SelectTrigger>
                  <SelectContent>
                    {books
                      .filter((book) => book.read_status === 'read')
                      .map((book) => (
                        <SelectItem key={book.id} value={book.id.toString()}>
                          {book.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="text">Conteúdo *</Label>
                <Textarea
                  id="text"
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  rows={10}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Criar Resumo</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-4">
        <SearchInput
          placeholder="Buscar resumos..."
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="flex-1"
        />
      </div>

      {filteredSummaries.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm
              ? 'Nenhum resumo encontrado para a pesquisa atual.'
              : 'Nenhum resumo cadastrado. Clique em "Novo Resumo" para começar.'
          }
        />
      ) : (
        <div className="grid gap-4">
          {filteredSummaries.map((summary) => (
            <Card key={summary.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      <CardTitle className="text-xl">{summary.book_title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {summary.is_vectorized ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Vetorizado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Não Vetorizado
                        </Badge>
                      )}
                      {summary.vectorization_date && (
                        <span className="text-xs">
                          em{' '}
                          {new Date(summary.vectorization_date).toLocaleDateString(
                            'pt-BR'
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(summary)}
                      aria-label="Editar"
                    >
                      <Edit className="w-4 h-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(summary.id)}
                      aria-label="Excluir"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-6 whitespace-pre-wrap text-sm">
                  {summary.text}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleEdit}>
            <DialogHeader>
              <DialogTitle>Editar Resumo</DialogTitle>
              <DialogDescription>Atualize as informações do resumo.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Título *</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-book">Livro *</Label>
                <Select
                  value={formData.book.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, book: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {books
                      .filter((book) => book.read_status === 'read')
                      .map((book) => (
                        <SelectItem key={book.id} value={book.id.toString()}>
                          {book.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-text">Conteúdo *</Label>
                <Textarea
                  id="edit-text"
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  rows={10}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Salvar Alterações</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
