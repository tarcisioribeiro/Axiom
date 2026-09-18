import { useState } from 'react';
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
}

export function RoutineFocusBlockForm({
  block,
  ownerId,
  onSubmit,
  onCancel,
  isLoading = false,
}: RoutineFocusBlockFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(block?.name ?? '');
  const [description, setDescription] = useState(block?.description ?? '');
  const [icon, setIcon] = useState<string | null | undefined>(block?.icon);
  const [color, setColor] = useState(block?.color ?? '#bd93f9');
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
      color,
      is_active: isActive,
      weekdays,
      owner: ownerId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-md">
      <div className="space-y-sm">
        <Label htmlFor="focus-block-name">
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
        <Label htmlFor="focus-block-description">
          {t('pages.routineTasks.focusBlocks.descriptionLabel')}
        </Label>
        <Textarea
          id="focus-block-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      <div className="gap-md grid grid-cols-2">
        <div className="space-y-sm">
          <Label>{t('pages.routineTasks.focusBlocks.iconLabel')}</Label>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
        <div className="space-y-sm">
          <Label htmlFor="focus-block-color">
            {t('pages.routineTasks.focusBlocks.colorLabel')}
          </Label>
          <input
            id="focus-block-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="border-input h-10 w-full cursor-pointer rounded-md border"
          />
        </div>
      </div>

      <div className="space-y-sm">
        <Label>{t('pages.routineTasks.focusBlocks.weekdaysLabel')}</Label>
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
        <Label>{t('pages.routineTasks.focusBlocks.activeLabel')}</Label>
        <StatusToggle
          value={isActive ? 'active' : 'inactive'}
          onChange={(v) => setIsActive(v === 'active')}
          options={[
            { value: 'active', label: t('pages.routineTasks.statusActive') },
            { value: 'inactive', label: t('pages.routineTasks.statusInactive') },
          ]}
        />
      </div>

      <div className="gap-sm pt-sm flex justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !name.trim() || weekdays.length === 0}
        >
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
