/* eslint-disable max-lines */
import {
  Upload,
  FileUp,
  CheckSquare,
  Square,
  CheckCircle2,
  AlertCircle,
  Info,
  Download,
} from 'lucide-react';
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { VaultGuard } from '@/components/security/VaultGuard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type {
  ImportFormat,
  ImportPreviewEntry,
  ImportPreviewResponse,
  ImportConfirmResponse,
} from '@/services/password-import-service';
import { passwordImportService } from '@/services/password-import-service';
import { getErrorMessage } from '@/utils/error-utils';

type Step = 'upload' | 'preview' | 'summary';

export default function PasswordImport() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('upload');
  const [format, setFormat] = useState<ImportFormat | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState<ImportConfirmResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFileChange = (f: File | null) => {
    setFile(f);
    setPreview(null);
    setSelected(new Set());
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileChange(dropped);
  };

  // ── Preview ────────────────────────────────────────────────────────────────

  const handlePreview = async () => {
    if (!file || !format) return;
    setIsLoading(true);
    try {
      const result = await passwordImportService.preview(file, format);
      setPreview(result);
      // Pre-select all non-duplicate entries
      const defaultSelected = new Set(
        result.entries.filter((e) => !e.is_duplicate).map((e) => e.index)
      );
      setSelected(defaultSelected);
      setStep('preview');
    } catch (err) {
      toast({
        title: t('pages.passwordImport.parseError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Selection ──────────────────────────────────────────────────────────────

  const toggleEntry = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!preview) return;
    setSelected(new Set(preview.entries.map((e) => e.index)));
  };

  const deselectAll = () => setSelected(new Set());

  // ── Confirm ────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!preview || selected.size === 0) {
      toast({
        title: t('pages.passwordImport.noSelection'),
        variant: 'destructive',
      });
      return;
    }

    const entries = preview.entries
      .filter((e) => selected.has(e.index))
      .map((e) => ({
        title: e.title,
        username: e.username,
        password: e.password,
        site: e.site,
        category: e.category,
        notes: e.notes,
      }));

    setIsLoading(true);
    try {
      const result = await passwordImportService.confirm(entries);
      setSummary(result);
      setStep('summary');
      toast({
        title: t('pages.passwordImport.importSuccess'),
        description: t('pages.passwordImport.importSuccessDesc', {
          imported: result.imported,
          duplicates: result.duplicates_skipped,
          errors: result.errors,
        }),
      });
    } catch (err) {
      toast({
        title: t('pages.passwordImport.importError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setStep('upload');
    setFormat('');
    setFile(null);
    setPreview(null);
    setSelected(new Set());
    setSummary(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <VaultGuard>
      <PageContainer>
        <PageHeader title={t('pages.passwordImport.title')} icon={<FileUp />} />

        {/* Upload step */}
        {step === 'upload' && (
          <Card className="mx-auto max-w-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-sm">
                <Upload className="h-5 w-5" />
                {t('pages.passwordImport.title')}
              </CardTitle>
              <CardDescription>{t('pages.passwordImport.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-md">
              {/* Format selector */}
              <div className="space-y-xs">
                <Label htmlFor="format-select">
                  {t('pages.passwordImport.formatLabel')}
                </Label>
                <Select
                  value={format}
                  onValueChange={(v) => setFormat(v as ImportFormat)}
                >
                  <SelectTrigger id="format-select">
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

              {/* Drop zone */}
              <div className="space-y-xs">
                <Label htmlFor="file-input">
                  {t('pages.passwordImport.uploadLabel')}
                </Label>
                <div
                  role="button"
                  tabIndex={0}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-xl transition-colors ${
                    isDragging
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/20'
                  }`}
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
                  onDrop={handleDrop}
                >
                  <FileUp className="mb-sm h-8 w-8 text-muted-foreground" />
                  {file ? (
                    <p className="text-sm font-medium">{file.name}</p>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {t('pages.passwordImport.uploadHint')}
                      </p>
                      {format && (
                        <p className="mt-xs text-xs text-muted-foreground">
                          {t('pages.passwordImport.uploadHintFormat', {
                            format: format === 'bitwarden_json' ? '.json' : '.csv',
                          })}
                        </p>
                      )}
                    </>
                  )}
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

              {/* Security note */}
              <div className="flex items-start gap-sm rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t('pages.passwordImport.description')}</span>
              </div>

              <Button
                className="w-full"
                disabled={!file || !format || isLoading}
                onClick={() => void handlePreview()}
              >
                {isLoading ? (
                  <LoadingState size="sm" />
                ) : (
                  <>
                    <Download className="mr-sm h-4 w-4" />
                    {t('pages.passwordImport.previewBtn')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Preview step */}
        {step === 'preview' && preview && (
          <div className="space-y-md">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('pages.passwordImport.previewTitle')}</CardTitle>
                    <CardDescription>
                      {t('pages.passwordImport.previewDesc')}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-sm">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      <CheckSquare className="mr-xs h-4 w-4" />
                      {t('pages.passwordImport.selectAll')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAll}>
                      <Square className="mr-xs h-4 w-4" />
                      {t('pages.passwordImport.deselectAll')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {preview.entries.length === 0 ? (
                  <p className="py-xl text-center text-muted-foreground">
                    {t('pages.passwordImport.emptyFile')}
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10" />
                          <TableHead>{t('pages.passwordImport.colTitle')}</TableHead>
                          <TableHead>{t('pages.passwordImport.colUsername')}</TableHead>
                          <TableHead>{t('pages.passwordImport.colSite')}</TableHead>
                          <TableHead>{t('pages.passwordImport.colStatus')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.entries.map((entry: ImportPreviewEntry) => (
                          <TableRow
                            key={entry.index}
                            className={entry.is_duplicate ? 'opacity-60' : undefined}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selected.has(entry.index)}
                                onCheckedChange={() => toggleEntry(entry.index)}
                                id={`entry-${entry.index}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <label
                                htmlFor={`entry-${entry.index}`}
                                className="cursor-pointer"
                              >
                                {entry.title || '—'}
                              </label>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {entry.username || '—'}
                            </TableCell>
                            <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                              {entry.site || '—'}
                            </TableCell>
                            <TableCell>
                              {entry.is_duplicate ? (
                                <Badge variant="secondary">
                                  {t('pages.passwordImport.duplicateBadge')}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-green-600">
                                  {t('pages.passwordImport.newBadge')}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={handleReset}>
                {t('common.cancel')}
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {t('pages.passwordImport.selectedCount', { count: selected.size })}
                </span>
                <Button
                  disabled={selected.size === 0 || isLoading}
                  onClick={() => void handleImport()}
                >
                  {isLoading
                    ? t('pages.passwordImport.importing')
                    : t('pages.passwordImport.importBtn')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Summary step */}
        {step === 'summary' && summary && (
          <Card className="mx-auto max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-sm">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                {t('pages.passwordImport.summaryTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-md">
              <div className="grid grid-cols-3 gap-md text-center">
                <div className="space-y-xs rounded-lg bg-green-50 p-md dark:bg-green-950/20">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {summary.imported}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('pages.passwordImport.summaryImported')}
                  </p>
                </div>
                <div className="space-y-xs rounded-lg bg-yellow-50 p-md dark:bg-yellow-950/20">
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                    {summary.duplicates_skipped}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('pages.passwordImport.summaryDuplicates')}
                  </p>
                </div>
                <div className="space-y-xs rounded-lg bg-red-50 p-md dark:bg-red-950/20">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {summary.errors}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('pages.passwordImport.summaryErrors')}
                  </p>
                </div>
              </div>

              {summary.errors > 0 && (
                <div className="flex items-start gap-sm rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {summary.errors}{' '}
                    {t('pages.passwordImport.summaryErrors').toLowerCase()}.
                  </span>
                </div>
              )}

              <Button className="w-full" onClick={handleReset}>
                {t('pages.passwordImport.importAnother')}
              </Button>
            </CardContent>
          </Card>
        )}
      </PageContainer>
    </VaultGuard>
  );
}
