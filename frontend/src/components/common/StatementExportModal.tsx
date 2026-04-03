import { FileText, Loader2, Download } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useStatementPdf } from '@/hooks/use-statement-pdf';
import { useToast } from '@/hooks/use-toast';

interface StatementExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toISODate(date: Date | undefined): string | undefined {
  if (!date) return undefined;
  return date.toISOString().split('T')[0];
}

export function StatementExportModal({
  open,
  onOpenChange,
}: StatementExportModalProps) {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [dateFrom, setDateFrom] = useState<Date | undefined>(firstDayOfMonth);
  const [dateTo, setDateTo] = useState<Date | undefined>(today);

  const { isGenerating, generateStatement } = useStatementPdf();
  const { toast } = useToast();

  const handleExport = async () => {
    const from = toISODate(dateFrom);
    const to = toISODate(dateTo);

    if (!from || !to) {
      toast({
        title: 'Período inválido',
        description: 'Selecione as datas de início e fim do extrato.',
        variant: 'destructive',
      });
      return;
    }

    if (from > to) {
      toast({
        title: 'Período inválido',
        description: 'A data de início deve ser anterior à data de fim.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await generateStatement({ dateFrom: from, dateTo: to });
      onOpenChange(false);
      toast({
        title: 'Extrato gerado com sucesso',
        description: 'O download do arquivo PDF foi iniciado.',
      });
    } catch {
      toast({
        title: 'Erro ao gerar extrato',
        description: 'Não foi possível gerar o PDF. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setDateFrom(firstDayOfMonth);
      setDateTo(today);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Exportar Extrato</DialogTitle>
              <DialogDescription className="text-xs">
                Extrato financeiro completo em PDF
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-md">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-xs">
              <Label className="text-sm">Data inicial</Label>
              <DatePicker
                value={dateFrom}
                onChange={setDateFrom}
                placeholder="De..."
                clearable
              />
            </div>
            <div className="space-y-xs">
              <Label className="text-sm">Data final</Label>
              <DatePicker
                value={dateTo}
                onChange={setDateTo}
                placeholder="Até..."
                clearable
              />
            </div>
          </div>

          <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground/70">O extrato incluirá:</p>
            <ul className="list-none space-y-0.5">
              <li>· Resumo de receitas, despesas e saldo</li>
              <li>· Saldos de todas as contas</li>
              <li>· Lista completa de lançamentos do período</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-sm pt-sm">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={isGenerating} className="gap-sm">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Exportar PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
