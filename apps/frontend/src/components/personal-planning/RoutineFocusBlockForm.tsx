import { FileText, Power, Repeat, Save, Smile, Type, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { IconPicker } from '@/components/ui/icon-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusToggle } from '@/components/ui/status-toggle';
import { Textarea } from '@/components/ui/textarea';
import type { FocusBlock, FocusBlockFormData } from '@/types';
import { WEEKDAY_CHOICES } from '@/types';

const ALL_WEEKDAYS = WEEKDAY_CHOICES.map((d) => d.value);

interface RoutineFocusBlockFormProps {
  block?: FocusBlock;
  ownerId: number;
  onSubmit: (data: FocusBlockFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  /** Editor de tarefas do bloco (só existe com o bloco já salvo), renderizado
   * acima do rodapé de ações para não ficar abaixo de Salvar/Cancelar. */
  tasksEditor?: ReactNode;
}

export function RoutineFocusBlockForm({
  block,
  ownerId,
  onSubmit,
  onCancel,
  isLoading = false,
  tasksEditor,
}: RoutineFocusBlockFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(block?.name ?? '');
  const [description, setDescription] = useState(block?.description ?? '');
  const [icon, setIcon] = useState<string | null | undefined>(block?.icon);
  const [isActive, setIsActive] = useState(block?.is_active ?? true);
  const [weekdays, setWeekdays] = useState<number[]>(
    block?.weekdays && block.weekdays.length > 0 ? block.weekdays : ALL_WEEKDAYS
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || weekdays.length === 0) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
      is_active: isActive,
      weekdays,
      owner: ownerId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-md">
      <div className="gap-md grid grid-cols-1 sm:grid-cols-3">
        <div className="space-y-sm">
          <Label className="gap-xs flex items-center" htmlFor="focus-block-name">
            <Type className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.routineTasks.focusBlocks.nameLabel')}
          </Label>
          <Input
            id="focus-block-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('pages.routineTasks.focusBlocks.namePlaceholder')}
            required
          />
        </div>

        <div className="space-y-sm">
          <Label className="gap-xs flex items-center" htmlFor="focus-block-description">
            <FileText className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.routineTasks.focusBlocks.descriptionLabel')}
          </Label>
          <Textarea
            id="focus-block-description"
            placeholder={t('common.placeholders.focusBlockDescription')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={1}
            className="min-h-0 resize-none"
          />
        </div>

        <div className="space-y-sm">
          <Label className="gap-xs flex items-center">
            <Smile className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.routineTasks.focusBlocks.iconLabel')}
          </Label>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
      </div>

      <div className="space-y-sm">
        <Label className="gap-xs flex items-center">
          <Repeat className="text-muted-foreground h-3.5 w-3.5" />
          {t('pages.routineTasks.focusBlocks.weekdaysLabel')}
        </Label>
        <div className="gap-sm grid grid-cols-7">
          {WEEKDAY_CHOICES.map((day) => (
            <div key={day.value} className="gap-xs flex flex-col items-center">
              <Checkbox
                id={`focus-block-weekday-${day.value}`}
                checked={weekdays.includes(day.value)}
                onCheckedChange={(checked) => {
                  setWeekdays(
                    checked
                      ? [...weekdays, day.value]
                      : weekdays.filter((d) => d !== day.value)
                  );
                }}
              />
              <Label
                htmlFor={`focus-block-weekday-${day.value}`}
                className="cursor-pointer text-xs"
              >
                {t(`pages.routineTasks.form.weekdayOptions.${day.value}`).substring(
                  0,
                  3
                )}
              </Label>
            </div>
          ))}
        </div>
        {weekdays.length === 0 && (
          <p className="text-destructive text-xs">
            {t('pages.routineTasks.focusBlocks.weekdaysRequired')}
          </p>
        )}
      </div>

      <div className="space-y-sm">
        <Label className="gap-xs flex items-center">
          <Power className="text-muted-foreground h-3.5 w-3.5" />
          {t('pages.routineTasks.focusBlocks.activeLabel')}
        </Label>
        <StatusToggle
          value={isActive ? 'true' : 'false'}
          onChange={(v) => setIsActive(v === 'true')}
          options={[
            { value: 'true', label: t('common.status.active'), accentColor: 'success' },
            { value: 'false', label: t('common.status.inactive') },
          ]}
        />
      </div>

      {tasksEditor && <div className="pt-sm border-t">{tasksEditor}</div>}

      <div className="dialog-footer gap-sm pt-sm flex justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !name.trim() || weekdays.length === 0}
        >
          <Save className="h-4 w-4" />
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
