/* eslint-disable max-lines */
import {
  ArrowLeftRight,
  CheckCircle2,
  FileUp,
  TrendingDown,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { formatCurrency, formatDate } from '@/lib/formatters';
import { accountsService } from '@/services/accounts-service';
import { bankReconciliationService } from '@/services/bank-reconciliation-service';
import type { Account, BankStatementEntry, BankStatementImport } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type Step = 'upload' | 'preview' | 'summary';

interface SummaryData {
  total: number;
  imported: number;
  ignored: number;
  matched: number;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const { t } = useTranslation();
  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: t('pages.bankStatementImport.step1') },
    { key: 'preview', label: t('pages.bankStatementImport.step2') },
    { key: 'summary', label: t('pages.bankStatementImport.step3') },
  ];
  const order: Record<Step, number> = { upload: 0, preview: 1, summary: 2 };

  return (
    <div className="flex items-center gap-sm text-sm">
      {steps.map((s, i) => (
        <span key={s.key} className="flex items-center gap-sm">
          <span
            className={
              order[current] >= order[s.key]
                ? 'font-semibold text-primary'
                : 'text-muted-foreground'
            }
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
        </span>
      ))}
    </div>
  );
}

// ─── Upload Step ──────────────────────────────────────────────────────────────

interface UploadStepProps {
  accounts: Account[];
  onImported: (importData: BankStatementImport) => void;
}

function UploadStep({ accounts, onImported }: UploadStepProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !accountId) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['ofx', 'csv'].includes(ext)) {
      toast({
        title: t('pages.bankStatementImport.upload.invalidFormat'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('account', accountId);
      const imported = await bankReconciliationService.importFile(formData);
      // Buscar detalhes com entries
      const detail = await bankReconciliationService.getImport(imported.id);
      onImported(detail);
    } catch (error: unknown) {
      toast({ title: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pages.bankStatementImport.upload.cardTitle')}</CardTitle>
        <CardDescription>
          {t('pages.bankStatementImport.upload.cardDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-md">
          {/* Dropzone */}
          <div
            role="button"
            tabIndex={0}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
          >
            <FileUp className="mb-3 h-10 w-10 text-muted-foreground" />
            {file ? (
              <p className="text-sm font-medium">{file.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {t('pages.bankStatementImport.upload.dropPrompt')}
                </p>
                <p className="mt-xs text-xs text-muted-foreground">
                  {t('pages.bankStatementImport.upload.dropFormats')}
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".ofx,.csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Account selector */}
          <div className="space-y-xs">
            <Label>{t('pages.bankStatementImport.upload.accountLabel')}</Label>
            <Select value={accountId} onValueChange={setAccountId} required>
              <SelectTrigger>
                <SelectValue
                  placeholder={t('pages.bankStatementImport.upload.accountPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={String(acc.id)}>
                    {acc.account_name}
                    {acc.institution ? ` — ${acc.institution}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={!file || !accountId || isLoading}
            className="w-full"
          >
            {isLoading ? (
              t('pages.bankStatementImport.upload.importing')
            ) : (
              <>
                <Upload className="mr-sm h-4 w-4" />
                {t('pages.bankStatementImport.upload.importBtn')}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Preview Step ─────────────────────────────────────────────────────────────

interface PreviewStepProps {
  importData: BankStatementImport;
  onConfirm: (summary: SummaryData) => void;
  onBack: () => void;
}

function PreviewStep({ importData, onConfirm, onBack }: PreviewStepProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const entries = importData.entries ?? [];
  const ignored = entries.filter((e) => e.status === 'ignored');
  const pending = entries.filter((e) => e.status !== 'ignored');

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const matched = await bankReconciliationService.runMatch(importData.id);
      onConfirm({
        total: entries.length,
        imported: pending.length,
        ignored: ignored.length,
        matched: matched.matched_count,
      });
    } catch (error: unknown) {
      toast({ title: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-md">
      <Card>
        <CardHeader>
          <CardTitle>{t('pages.bankStatementImport.preview.cardTitle')}</CardTitle>
          <CardDescription>
            {t('pages.bankStatementImport.preview.cardDesc', {
              pending: pending.length,
            })}
            {ignored.length > 0 &&
              t('pages.bankStatementImport.preview.cardDescIgnored', {
                ignored: ignored.length,
              })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t('pages.bankStatementImport.preview.colDate')}
                  </TableHead>
                  <TableHead>
                    {t('pages.bankStatementImport.preview.colDescription')}
                  </TableHead>
                  <TableHead className="text-right">
                    {t('pages.bankStatementImport.preview.colAmount')}
                  </TableHead>
                  <TableHead>
                    {t('pages.bankStatementImport.preview.colType')}
                  </TableHead>
                  <TableHead>
                    {t('pages.bankStatementImport.preview.colStatus')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry: BankStatementEntry) => (
                  <TableRow
                    key={entry.id}
                    className={
                      entry.status === 'ignored' ? 'bg-muted/40 opacity-60' : ''
                    }
                  >
                    <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {entry.description}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      <span
                        className={
                          entry.transaction_type === 'credit'
                            ? 'text-success'
                            : 'text-destructive'
                        }
                      >
                        {entry.transaction_type === 'credit' ? '+' : '-'}
                        {formatCurrency(Math.abs(parseFloat(entry.amount)))}
                      </span>
                    </TableCell>
                    <TableCell>
                      {entry.transaction_type === 'credit' ? (
                        <TrendingUp className="h-4 w-4 text-success" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.status === 'ignored' ? (
                        <Badge variant="secondary">
                          {t('pages.bankStatementImport.preview.statusExists')}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {t('pages.bankStatementImport.preview.statusNew')}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-xl text-center text-muted-foreground"
                    >
                      {t('pages.bankStatementImport.preview.noTransactions')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          {t('common.actions.back')}
        </Button>
        <Button onClick={handleConfirm} disabled={isLoading || pending.length === 0}>
          {isLoading
            ? t('pages.bankStatementImport.preview.processing')
            : t('pages.bankStatementImport.preview.confirmBtn', {
                count: pending.length,
              })}
        </Button>
      </div>
    </div>
  );
}

// ─── Summary Step ─────────────────────────────────────────────────────────────

function SummaryStep({ summary }: { summary: SummaryData }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-sm">
          <CheckCircle2 className="h-5 w-5 text-success" />
          {t('pages.bankStatementImport.summary.cardTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-md">
        <div className="grid grid-cols-2 gap-md sm:grid-cols-4">
          <div className="rounded-lg border p-md text-center">
            <p className="text-2xl font-bold">{summary.total}</p>
            <p className="text-xs text-muted-foreground">
              {t('pages.bankStatementImport.summary.totalDetected')}
            </p>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/5 p-md text-center">
            <p className="text-2xl font-bold text-success">{summary.imported}</p>
            <p className="text-xs text-muted-foreground">
              {t('pages.bankStatementImport.summary.imported')}
            </p>
          </div>
          <div className="rounded-lg border p-md text-center">
            <p className="text-2xl font-bold text-muted-foreground">
              {summary.ignored}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('pages.bankStatementImport.summary.ignoredDuplicates')}
            </p>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-md text-center">
            <p className="text-2xl font-bold text-primary">{summary.matched}</p>
            <p className="text-xs text-muted-foreground">
              {t('pages.bankStatementImport.summary.autoLinked')}
            </p>
          </div>
        </div>
        <Button onClick={() => void navigate('/bank-reconciliation')}>
          {t('pages.bankStatementImport.summary.viewImports')}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function BankStatementImport() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('upload');
  const [importData, setImportData] = useState<BankStatementImport | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    accountsService
      .getAll()
      .then(setAccounts)
      .catch((err: unknown) => {
        toast({ title: getErrorMessage(err), variant: 'destructive' });
      })
      .finally(() => setLoadingAccounts(false));
  }, [toast]);

  if (loadingAccounts) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.bankStatementImport.title')}
        icon={<ArrowLeftRight />}
      />
      <StepIndicator current={step} />

      {step === 'upload' && (
        <UploadStep
          accounts={accounts}
          onImported={(data) => {
            setImportData(data);
            setStep('preview');
          }}
        />
      )}

      {step === 'preview' && importData && (
        <PreviewStep
          importData={importData}
          onConfirm={(s) => {
            setSummary(s);
            setStep('summary');
          }}
          onBack={() => {
            setImportData(null);
            setStep('upload');
          }}
        />
      )}

      {step === 'summary' && summary && <SummaryStep summary={summary} />}
    </PageContainer>
  );
}
