import { pdf } from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';
import React, { useCallback, useState } from 'react';

import { RoutineWeeklyDocument } from '@/components/pdf/RoutineWeeklyDocument';
import { logger } from '@/lib/logger';
import { buildWeeklySchedule, exportScheduleToExcel } from '@/lib/routine-export';
import type { RoutineTask } from '@/types';

interface UseRoutineExportReturn {
  isExporting: boolean;
  exportPDF: (tasks: RoutineTask[], ownerName?: string) => Promise<void>;
  exportExcel: (tasks: RoutineTask[]) => Promise<void>;
}

export function useRoutineExport(): UseRoutineExportReturn {
  const [isExporting, setIsExporting] = useState(false);

  const exportPDF = useCallback(async (tasks: RoutineTask[], ownerName?: string) => {
    setIsExporting(true);
    try {
      const schedule = buildWeeklySchedule(tasks);
      const blob = await pdf(
        React.createElement(RoutineWeeklyDocument, {
          schedule,
          ownerName,
        }) as unknown as React.ReactElement<DocumentProps>
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rotina-semanal.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('Erro ao gerar PDF da rotina:', err);
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportExcel = useCallback(async (tasks: RoutineTask[]) => {
    const schedule = buildWeeklySchedule(tasks);
    await exportScheduleToExcel(schedule);
  }, []);

  return { isExporting, exportPDF, exportExcel };
}
