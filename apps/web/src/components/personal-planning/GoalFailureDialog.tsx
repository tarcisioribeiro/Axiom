import { AlertTriangle, CalendarDays, Clock, Save, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { TimePicker } from '@/components/ui/time-picker';
import { useToast } from '@/hooks/use-toast';
import { formatLocalDate } from '@/lib/utils';
import { goalsService } from '@/services/goals-service';
import type { Goal } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface Props {
  goal: Pick<Goal, 'id'> | undefined;
  /** Data inicial (padrão: hoje). */
  defaultDate?: string;
  onClose: () => void;
  onRegistered: () => void;
}

const nowTime = () => new Date().toTimeString().slice(0, 5);

/** Registro de falha num objetivo (data + hora), usado na tela de Objetivos
 * e na revisão diária. */
export function GoalFailureDialog({ goal, defaultDate, onClose, onRegistered }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [invalidTime, setInvalidTime] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState<number | undefined>();

  // Valores padrão a cada abertura
  if (goal?.id !== openedFor) {
    setOpenedFor(goal?.id);
    setDate(defaultDate ?? formatLocalDate(new Date()));
    setTime(nowTime());
    setInvalidTime(false);
  }

  const submit = async () => {
    if (!goal) return;
    if (!time) {
      setInvalidTime(true);
      toast({
        title: t('common.fieldRequired', { field: t('pages.goals.failureTimeLabel') }),
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      await goalsService.registerFailure(goal.id, date, time);
      toast({ title: t('pages.goals.failureRegisteredDesc') });
      onRegistered();
    } catch (error) {
      toast({
        title: t('pages.goals.failureError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!goal} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle icon={AlertTriangle}>
            {t('pages.goals.registerFailureTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="gap-md grid grid-cols-2">
          <FormField
            id="failure-date"
            label={t('pages.goals.failureDateLabel')}
            icon={CalendarDays}
          >
            <DatePicker
              value={date}
              maxDate={new Date()}
              onChange={(d) => d && setDate(formatLocalDate(d))}
            />
          </FormField>
          <FormField
            id="failure-time"
            label={t('pages.goals.failureTimeLabel')}
            icon={Clock}
          >
            <TimePicker
              value={time}
              clearable={false}
              aria-invalid={invalidTime}
              onChange={(v) => {
                setTime(v ?? '');
                setInvalidTime(false);
              }}
            />
          </FormField>
        </div>
        <DialogFooter className="gap-sm">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4" />
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={() => void submit()} loading={saving}>
            {!saving && <Save className="h-4 w-4" />}
            {t('pages.goals.registerFailureConfirmBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
