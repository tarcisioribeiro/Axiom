/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Edit,
  Trash2,
  FileText,
  BookOpen,
  CheckCircle2,
  XCircle,
  Highlighter,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
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
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { bookHighlightsService } from '@/services/book-highlights-service';
import { booksService } from '@/services/books-service';
import { summariesService } from '@/services/summaries-service';
import type { BookHighlight, Summary, SummaryFormData, Book } from '@/types';

import { GhostTextarea } from './GhostTextarea';

interface SummariesTabProps {
  isCreateOpen: boolean;
  onCreateClose: () => void;
}

const EMPTY_FORM: SummaryFormData = { title: '', book: 0, text: '', owner: 0 };

const EMPTY_SUMMARIES: Summary[] = [];
const EMPTY_BOOKS: Book[] = [];
const EMPTY_HIGHLIGHTS: BookHighlight[] = [];

export function SummariesTab({ isCreateOpen, onCreateClose }: SummariesTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);
  const [formData, setFormData] = useState<SummaryFormData>(EMPTY_FORM);
  const { showConfirm } = useAlertDialog();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: pageData, isLoading: loading } = useQuery({
    queryKey: ['summaries-tab'],
    queryFn: async () => {
      try {
        const [summariesData, booksData, highlightsData] = await Promise.all([
          summariesService.getAll(),
          booksService.getAll(),
          bookHighlightsService.getAll(),
        ]);
        return {
          summaries: summariesData,
          books: booksData,
          highlights: highlightsData,
        };
      } catch {
        toast({ title: t('common.messages.loadError'), variant: 'destructive' });
        return {
          summaries: EMPTY_SUMMARIES,
          books: EMPTY_BOOKS,
          highlights: EMPTY_HIGHLIGHTS,
        };
      }
    },
  });
  const summaries = pageData?.summaries ?? EMPTY_SUMMARIES;
  const books = pageData?.books ?? EMPTY_BOOKS;
  const highlights = pageData?.highlights ?? EMPTY_HIGHLIGHTS;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['summaries-tab'] });

  const handleCreateOpen = () => {
    if (books.length === 0) {
      toast({
        title: t('common.messages.actionDenied'),
        description: t('pages.summaries.noBookMsg'),
        variant: 'destructive',
      });
      onCreateClose();
    } else {
      setFormData(EMPTY_FORM);
    }
  };

  // Reinicia o formulário quando o dialog de criação abre (derivado durante
  // o render — sem efeito — comparando com a última transição de `isCreateOpen`).
  const [lastIsCreateOpen, setLastIsCreateOpen] = useState(isCreateOpen);
  if (isCreateOpen !== lastIsCreateOpen) {
    setLastIsCreateOpen(isCreateOpen);
    if (isCreateOpen) handleCreateOpen();
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await summariesService.create(formData);
      toast({
        title: t('pages.summaries.created'),
        description: t('pages.summaries.createdDesc'),
      });
      onCreateClose();
      setFormData(EMPTY_FORM);
      void refresh();
    } catch {
      toast({ title: t('common.messages.createError'), variant: 'destructive' });
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
      setIsEditOpen(false);
      setSelectedSummary(null);
      setFormData(EMPTY_FORM);
      void refresh();
    } catch {
      toast({ title: t('common.messages.updateError'), variant: 'destructive' });
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
    setIsEditOpen(true);
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
      void refresh();
    } catch {
      toast({ title: t('common.messages.deleteError'), variant: 'destructive' });
    }
  };

  const filteredSummaries = summaries.filter(
    (s) =>
      s.book_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const readBooks = books;

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-md">
      <SearchInput
        placeholder={t('pages.summaries.searchPlaceholder')}
        value={searchTerm}
        onValueChange={setSearchTerm}
        className="flex-1"
      />

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
        <div className="grid gap-md">
          {filteredSummaries.map((summary) => (
            <Card key={summary.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-sm flex items-center gap-sm">
                      <BookOpen className="h-5 w-5" />
                      <CardTitle className="text-xl">{summary.book_title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-sm">
                      {summary.is_vectorized ? (
                        <Badge variant="default" className="gap-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('pages.summaries.vectorized')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-xs">
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
                  <div className="flex gap-sm">
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
                      onClick={() => void handleDelete(summary.id)}
                      aria-label={t('common.actions.delete')}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-6 whitespace-pre-wrap text-sm">
                  {summary.text}
                </p>
                {(() => {
                  const bookHighlights = highlights.filter(
                    (h) => h.book === summary.book
                  );
                  if (bookHighlights.length === 0) return null;
                  return (
                    <div className="border-t pt-3">
                      <p className="mb-sm flex items-center gap-sm text-xs font-medium text-muted-foreground">
                        <Highlighter className="h-3.5 w-3.5" />
                        {bookHighlights.length} destaque
                        {bookHighlights.length !== 1 ? 's' : ''} relacionado
                        {bookHighlights.length !== 1 ? 's' : ''}
                      </p>
                      <div className="space-y-sm">
                        {bookHighlights.slice(0, 3).map((h) => (
                          <p
                            key={h.id}
                            className="line-clamp-2 border-l-2 border-primary/40 pl-sm text-xs text-muted-foreground"
                          >
                            {h.text}
                          </p>
                        ))}
                        {bookHighlights.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{bookHighlights.length - 3} mais
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={isCreateOpen && books.length > 0}
        onOpenChange={(open) => {
          if (!open) onCreateClose();
        }}
      >
        <DialogContent className="max-w-2xl">
          <form onSubmit={(e) => void handleCreate(e)}>
            <DialogHeader>
              <DialogTitle>{t('pages.summaries.createTitle')}</DialogTitle>
              <DialogDescription>{t('pages.summaries.createDesc')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-md py-md">
              <div className="space-y-sm">
                <Label htmlFor="title">{t('pages.summaries.titleField')}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-sm">
                <Label htmlFor="book">{t('pages.summaries.bookField')}</Label>
                <Select
                  value={formData.book.toString()}
                  onValueChange={(v) => setFormData({ ...formData, book: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('pages.summaries.bookPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {readBooks.map((b) => (
                      <SelectItem key={b.id} value={b.id.toString()}>
                        {b.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-sm">
                <Label htmlFor="text">{t('pages.summaries.contentField')}</Label>
                <GhostTextarea
                  id="text"
                  value={formData.text}
                  onChange={(val) => setFormData({ ...formData, text: val })}
                  bookId={formData.book || null}
                  rows={10}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">{t('pages.summaries.createBtn')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={(e) => void handleEdit(e)}>
            <DialogHeader>
              <DialogTitle>{t('pages.summaries.editTitle')}</DialogTitle>
              <DialogDescription>{t('pages.summaries.editDesc')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-md py-md">
              <div className="space-y-sm">
                <Label htmlFor="edit-title">{t('pages.summaries.titleField')}</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-sm">
                <Label htmlFor="edit-book">{t('pages.summaries.bookField')}</Label>
                <Select
                  value={formData.book.toString()}
                  onValueChange={(v) => setFormData({ ...formData, book: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {readBooks.map((b) => (
                      <SelectItem key={b.id} value={b.id.toString()}>
                        {b.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-sm">
                <Label htmlFor="edit-text">{t('pages.summaries.contentField')}</Label>
                <GhostTextarea
                  id="edit-text"
                  value={formData.text}
                  onChange={(val) => setFormData({ ...formData, text: val })}
                  bookId={formData.book || null}
                  rows={10}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">{t('pages.summaries.saveBtn')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
