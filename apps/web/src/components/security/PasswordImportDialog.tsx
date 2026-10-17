/* eslint-disable max-lines */
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  FileType,
  FileUp,
  Import,
  RotateCcw,
  Square,
  Tags,
  Upload,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { StepNav } from '@/components/common/StepNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { slideVariants } from '@/lib/animations';
import { cn } from '@/lib/utils';
import type {
  ImportFormat,
  ImportPreviewEntry,
  ImportPreviewResponse,
  ImportConfirmResponse,
} from '@/services/password-import-service';
import { passwordImportService } from '@/services/password-import-service';
import { PASSWORD_CATEGORIES } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const STEPS = ['upload', 'preview', 'mapping'] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Importação em etapas (§2.4): Cancelar sempre, Voltar a partir da 2ª etapa. */
export function PasswordImportDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [format, setFormat] = useState<ImportFormat | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [triedPreview, setTriedPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState<ImportConfirmResponse | null>(null);
  const [categoryMapping, setCategoryMapping] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const reset = () => {
    setStep(0);
    setDirection(1);
    setFormat('');
    setFile(null);
    setTriedPreview(false);
    setPreview(null);
    setSelected(new Set());
    setSummary(null);
    setCategoryMapping({});
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const handleFileChange = (f: File | null) => {
    setFile(f);
    setPreview(null);
    setSelected(new Set());
  };

  const handlePreview = async () => {
    if (!format || !file) {
      setTriedPreview(true);
      toast({
        title: t('common.fieldRequired', {
          field: !format
            ? t('pages.passwordImport.formatLabel')
            : t('pages.passwordImport.uploadLabel'),
        }),
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true);
    try {
      const result = await passwordImportService.preview(file, format);
      setPreview(result);
      setSelected(
        new Set(result.entries.filter((e) => !e.is_duplicate).map((e) => e.index))
      );
      goTo(1);
    } catch (err) {
      toast({
        title: t('pages.passwordImport.parseError', { reason: getErrorMessage(err) }),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEntry = (index: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const handleGoToMapping = () => {
    if (!preview || selected.size === 0) {
      toast({ title: t('pages.passwordImport.noSelection'), variant: 'destructive' });
      return;
    }
    const mapping: Record<string, string> = {};
    for (const e of preview.entries) {
      if (!selected.has(e.index)) continue;
      const cat = e.category || 'other';
      mapping[cat] = PASSWORD_CATEGORIES.some((c) => c.value === cat) ? cat : 'other';
    }
    setCategoryMapping(mapping);
    goTo(2);
  };

  // Importar fica sempre visível: antes da última etapa, valida e leva à
  // etapa que falta (pré-visualização, seleção ou mapeamento de categorias).
  const handleImportClick = () => {
    if (step === 0) void handlePreview();
    else if (step === 1) handleGoToMapping();
    else void handleImport();
  };

  const handleImport = async () => {
    if (!preview) return;
    const entries = preview.entries
      .filter((e) => selected.has(e.index))
      .map((e) => ({
        title: e.title,
        username: e.username,
        password: e.password,
        site: e.site,
        category: categoryMapping[e.category || 'other'] ?? e.category ?? 'other',
        notes: e.notes,
      }));

    setIsLoading(true);
    try {
      const result = await passwordImportService.confirm(entries);
      setSummary(result);
      setDirection(1);
      toast({
        title: t('pages.passwordImport.importSuccessDesc', {
          imported: result.imported,
          duplicates: result.duplicates_skipped,
          errors: result.errors,
        }),
      });
    } catch (err) {
      toast({
        title: t('pages.passwordImport.importError', { reason: getErrorMessage(err) }),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const header = summary
    ? { icon: CheckCircle2, title: t('pages.passwordImport.summaryTitle') }
    : [
        { icon: Upload, title: t('pages.passwordImport.title') },
        { icon: CheckSquare, title: t('pages.passwordImport.previewTitle') },
        { icon: Tags, title: t('pages.passwordImport.mappingTitle') },
      ][step];

  const columns = [
    {
      key: 'select',
      label: '',
      className: 'w-10',
      render: (entry: ImportPreviewEntry) => (
        <Checkbox
          checked={selected.has(entry.index)}
          onCheckedChange={() => toggleEntry(entry.index)}
          aria-label={entry.title || '—'}
        />
      ),
    },
    {
      key: 'title',
      label: t('pages.passwordImport.colTitle'),
      render: (entry: ImportPreviewEntry) => (
        <div className="max-w-48 truncate font-medium" title={entry.title}>
          {entry.title || '—'}
        </div>
      ),
    },
    {
      key: 'username',
      label: t('pages.passwordImport.colUsername'),
      render: (entry: ImportPreviewEntry) => (
        <div className="text-muted-foreground max-w-48 truncate" title={entry.username}>
          {entry.username || '—'}
        </div>
      ),
    },
    {
      key: 'site',
      label: t('pages.passwordImport.colSite'),
      render: (entry: ImportPreviewEntry) => (
        <div className="text-muted-foreground max-w-48 truncate" title={entry.site}>
          {entry.site || '—'}
        </div>
      ),
    },
    {
      key: 'status',
      label: t('pages.passwordImport.colStatus'),
      align: 'center' as const,
      render: (entry: ImportPreviewEntry) =>
        entry.is_duplicate ? (
          <Badge variant="secondary">{t('pages.passwordImport.duplicateBadge')}</Badge>
        ) : (
          <Badge variant="success">{t('pages.passwordImport.newBadge')}</Badge>
        ),
    },
  ];

  const mappingRows = Object.entries(categoryMapping);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle icon={header.icon}>{header.title}</DialogTitle>
          <DialogDescription>{header.title}</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={summary ? 'summary' : STEPS[step]}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-md"
            >
              {summary ? (
                <div className="gap-md grid grid-cols-3 text-center">
                  {(
                    [
                      ['success', summary.imported, 'summaryImported'],
                      ['warning', summary.duplicates_skipped, 'summaryDuplicates'],
                      ['destructive', summary.errors, 'summaryErrors'],
                    ] as const
                  ).map(([tone, value, key]) => (
                    <div key={key} className="space-y-xs p-md rounded-lg border">
                      <p className={cn('text-2xl font-bold', `text-${tone}`)}>
                        {value}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t(`pages.passwordImport.${key}`)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : step === 0 ? (
                <>
                  <div className="space-y-xs">
                    <Label className="gap-xs flex items-center" htmlFor="format-select">
                      <FileType className="text-muted-foreground h-3.5 w-3.5" />
                      {t('pages.passwordImport.formatLabel')}
                    </Label>
                    <Select
                      value={format}
                      onValueChange={(v) => setFormat(v as ImportFormat)}
                    >
                      <SelectTrigger
                        id="format-select"
                        aria-invalid={triedPreview && !format}
                      >
                        <SelectValue
                          placeholder={t('pages.passwordImport.formatPlaceholder')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bitwarden_json">
                          {t('pages.passwordImport.formatBitwarden')}
                        </SelectItem>
                        <SelectItem value="lastpass_csv">
                          {t('pages.passwordImport.formatLastpass')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-xs">
                    <Label className="gap-xs flex items-center" htmlFor="file-input">
                      <Upload className="text-muted-foreground h-3.5 w-3.5" />
                      {t('pages.passwordImport.uploadLabel')}
                    </Label>
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'p-xl flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
                        isDragging
                          ? 'border-primary bg-primary/5'
                          : triedPreview && !file
                            ? 'border-destructive'
                            : 'border-muted-foreground/30 hover:border-primary/50'
                      )}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ')
                          fileInputRef.current?.click();
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const dropped = e.dataTransfer.files[0];
                        if (dropped) handleFileChange(dropped);
                      }}
                    >
                      <FileUp className="mb-sm text-muted-foreground h-8 w-8" />
                      <p
                        className={cn(
                          'text-sm',
                          file ? 'font-medium' : 'text-muted-foreground'
                        )}
                      >
                        {file ? file.name : t('pages.passwordImport.uploadHint')}
                      </p>
                    </div>
                    <input
                      id="file-input"
                      ref={fileInputRef}
                      type="file"
                      accept={format === 'bitwarden_json' ? '.json' : '.csv'}
                      className="hidden"
                      onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </>
              ) : step === 1 && preview ? (
                preview.entries.length === 0 ? (
                  <EmptyState title={t('pages.passwordImport.emptyFile')} />
                ) : (
                  <>
                    <div className="gap-sm flex items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSelected(new Set(preview.entries.map((e) => e.index)))
                        }
                      >
                        <CheckSquare className="h-4 w-4" />
                        {t('pages.passwordImport.selectAll')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelected(new Set())}
                      >
                        <Square className="h-4 w-4" />
                        {t('pages.passwordImport.deselectAll')}
                      </Button>
                      <span className="text-muted-foreground ml-auto text-sm">
                        {t('pages.passwordImport.selectedCount', {
                          count: selected.size,
                        })}
                      </span>
                    </div>
                    <DataTable
                      data={preview.entries}
                      columns={columns}
                      keyExtractor={(e) => e.index}
                      rowClassName={(e) => (e.is_duplicate ? 'opacity-60' : '')}
                      pinNav={false}
                    />
                  </>
                )
              ) : mappingRows.length === 0 ? (
                <EmptyState title={t('pages.passwordImport.noCategoriesToMap')} />
              ) : (
                <PaginatedSlide
                  items={mappingRows}
                  pageSize={LIST_PAGE_SIZE}
                  pinNav={false}
                  className="space-y-sm"
                >
                  {(rows) =>
                    rows.map(([source, target]) => (
                      <div key={source} className="gap-md flex items-center">
                        <div className="w-40 shrink-0">
                          <Badge variant="secondary">{source}</Badge>
                        </div>
                        <ArrowRight
                          className="text-muted-foreground h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <Select
                          value={target}
                          onValueChange={(val) =>
                            setCategoryMapping((prev) => ({ ...prev, [source]: val }))
                          }
                        >
                          <SelectTrigger className="flex-1" aria-label={source}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PASSWORD_CATEGORIES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {t(`pages.passwords.categories.${cat.value}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))
                  }
                </PaginatedSlide>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {summary ? (
          <DialogCloseFooter>
            <Button onClick={reset}>
              <RotateCcw />
              {t('pages.passwordImport.importAnother')}
            </Button>
          </DialogCloseFooter>
        ) : (
          <>
            <StepNav
              onBack={() => goTo(step - 1)}
              onNext={() =>
                step === 0 ? void handlePreview() : step === 1 && handleGoToMapping()
              }
              isFirst={step === 0}
              isLast={step === 2}
              disabled={isLoading}
            />
            <DialogFooter className="gap-sm">
              <Button variant="outline" onClick={close}>
                <X />
                {t('common.actions.cancel')}
              </Button>
              <Button onClick={handleImportClick} loading={isLoading}>
                {!isLoading && <Import />}
                {t('pages.passwordImport.importBtn')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
