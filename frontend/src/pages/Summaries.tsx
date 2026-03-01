import {
  Plus,
  Edit,
  Trash2,
  FileText,
  BookOpen,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { booksService } from '@/services/books-service';
import { summariesService } from '@/services/summaries-service';
import type { Summary, SummaryFormData, Book } from '@/types';

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
  const { t } = useTranslation();

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
        title: t('common.messages.loadError'),
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
        title: t('pages.summaries.created'),
        description: t('pages.summaries.createdDesc'),
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
        title: t('common.messages.createError'),
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
        title: t('pages.summaries.updated'),
        description: t('pages.summaries.updatedDesc'),
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
        title: t('common.messages.updateError'),
        description: 'Não foi possível atualizar o resumo.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.summaries.deleteTitle'),
      description: t('pages.summaries.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await summariesService.delete(id);
      toast({
        title: t('pages.summaries.deleted'),
        description: t('pages.summaries.deletedDesc'),
      });
      void loadData();
    } catch {
      toast({
        title: t('common.messages.deleteError'),
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
        title: t('common.messages.actionDenied'),
        description: t('pages.summaries.noBookMsg'),
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
        title={t('pages.summaries.title')}
        icon={<FileText />}
        action={{
          label: t('pages.summaries.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreateClick,
        }}
      />

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>{t('pages.summaries.createTitle')}</DialogTitle>
              <DialogDescription>{t('pages.summaries.createDesc')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('pages.summaries.titleField')}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="book">{t('pages.summaries.bookField')}</Label>
                <Select
                  value={formData.book.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, book: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('pages.summaries.bookPlaceholder')} />
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
                <Label htmlFor="text">{t('pages.summaries.contentField')}</Label>
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
              <Button type="submit">{t('pages.summaries.createBtn')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-4">
        <SearchInput
          placeholder={t('pages.summaries.searchPlaceholder')}
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
              ? t('pages.summaries.emptySearch')
              : t('pages.summaries.emptyState')
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
                          {t('pages.summaries.vectorized')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          {t('pages.summaries.notVectorized')}
                        </Badge>
                      )}
                      {summary.vectorization_date && (
                        <span className="text-xs">
                          {t('pages.summaries.datePrefix', {
                            date: new Date(
                              summary.vectorization_date
                            ).toLocaleDateString('pt-BR'),
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(summary)}
                      aria-label={t('common.actions.edit')}
                    >
                      <Edit className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(summary.id)}
                      aria-label={t('common.actions.delete')}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
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
              <DialogTitle>{t('pages.summaries.editTitle')}</DialogTitle>
              <DialogDescription>{t('pages.summaries.editDesc')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">{t('pages.summaries.titleField')}</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-book">{t('pages.summaries.bookField')}</Label>
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
                <Label htmlFor="edit-text">{t('pages.summaries.contentField')}</Label>
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
              <Button type="submit">{t('pages.summaries.saveBtn')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
