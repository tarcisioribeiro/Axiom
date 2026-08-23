import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
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
import type { Tag, TagFormData } from '@/types';

const DEFAULT_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
];

interface TagFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: Tag | null;
  form: TagFormData;
  setForm: Dispatch<SetStateAction<TagFormData>>;
  onSubmit: (e: FormEvent) => void;
  isPending: boolean;
}

export function TagFormDialog({
  open,
  onOpenChange,
  selected,
  form,
  setForm,
  onSubmit,
  isPending,
}: TagFormDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {selected ? t('pages.tags.editTitle') : t('pages.tags.newTitle')}
          </DialogTitle>
          <DialogDescription>
            {selected ? t('pages.tags.editDesc') : t('pages.tags.newDesc')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-md">
          <div className="space-y-sm">
            <Label htmlFor="tag-name">{t('pages.tags.name')}</Label>
            <Input
              id="tag-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder={t('pages.tags.name')}
              required
            />
          </div>
          <div className="space-y-sm">
            <Label>{t('pages.tags.color')}</Label>
            <div className="gap-sm flex flex-wrap">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, color: c }))}
                  className="hoverable:hover:scale-110 h-7 w-7 rounded-full transition-transform"
                  style={{
                    backgroundColor: c,
                    outline: form.color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
                title={t('pages.tags.color')}
              />
            </div>
            {form.color && (
              <span
                className="px-sm inline-block rounded-full py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${form.color}22`, color: form.color }}
              >
                {form.name || t('pages.tags.name')}
              </span>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !form.name.trim()}>
              {isPending
                ? t('common.actions.saving')
                : selected
                  ? t('common.actions.save')
                  : t('common.actions.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
