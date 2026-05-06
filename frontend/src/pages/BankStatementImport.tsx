import {
  ArrowLeftRight,
  CheckCircle2,
  FileUp,
  TrendingDown,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: '1. Upload' },
    { key: 'preview', label: '2. Prévia' },
    { key: 'summary', label: '3. Resumo' },
  ];
  const order: Record<Step, number> = { upload: 0, preview: 1, summary: 2 };

  return (
    <div className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <span key={s.key} className="flex items-center gap-2">
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
      toast({ title: 'Formato inválido. Use .ofx ou .csv', variant: 'destructive' });
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
        <CardTitle>Selecionar arquivo</CardTitle>
        <CardDescription>
          Faça upload do seu extrato bancário no formato OFX ou CSV.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
                  Arraste o arquivo ou clique para selecionar
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Formatos suportados: .ofx, .csv
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
          <div className="space-y-1">
            <Label>Conta de destino</Label>
            <Select value={accountId} onValueChange={setAccountId} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta..." />
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
              'Importando...'
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Importar e visualizar
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Prévia das transações</CardTitle>
          <CardDescription>
            {pending.length} transação(ões) nova(s) detectada(s).
            {ignored.length > 0 && ` ${ignored.length} duplicata(s) serão ignoradas.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
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
                        <Badge variant="secondary">Já existe</Badge>
                      ) : (
                        <Badge variant="outline">Novo</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Nenhuma transação encontrada.
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
          Voltar
        </Button>
        <Button onClick={handleConfirm} disabled={isLoading || pending.length === 0}>
          {isLoading ? 'Processando...' : `Confirmar importação (${pending.length})`}
        </Button>
      </div>
    </div>
  );
}

// ─── Summary Step ─────────────────────────────────────────────────────────────

function SummaryStep({ summary }: { summary: SummaryData }) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-success" />
          Importação concluída
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold">{summary.total}</p>
            <p className="text-xs text-muted-foreground">Total detectado</p>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
            <p className="text-2xl font-bold text-success">{summary.imported}</p>
            <p className="text-xs text-muted-foreground">Importado</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">
              {summary.ignored}
            </p>
            <p className="text-xs text-muted-foreground">Duplicatas ignoradas</p>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
            <p className="text-2xl font-bold text-primary">{summary.matched}</p>
            <p className="text-xs text-muted-foreground">Vinculados automaticamente</p>
          </div>
        </div>
        <Button onClick={() => void navigate('/bank-reconciliation')}>
          Ver extratos importados
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function BankStatementImport() {
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
      <PageHeader title="Importar extrato bancário" icon={<ArrowLeftRight />} />
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
