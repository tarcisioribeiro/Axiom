import { Loader2, Save, X } from 'lucide-react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
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
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import type { Tag, TagFormData } from '@/types';

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
        <DialogHeader sticky>
          <DialogTitle mode={selected ? 'edit' : 'create'}>
            {selected ? t('pages.tags.editTitle') : t('pages.tags.newTitle')}
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>
              {selected ? t('pages.tags.editDesc') : t('pages.tags.newDesc')}
            </DialogDescription>
          </VisuallyHidden>
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
            <Label htmlFor="tag-color">{t('pages.tags.color')}</Label>
            <ColorPicker
              id="tag-color"
              value={form.color}
              onChange={(color) => setForm((p) => ({ ...p, color }))}
            />
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
              <X className="mr-sm h-4 w-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !form.name.trim()}>
              {isPending ? (
                <Loader2 className="mr-sm h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-sm h-4 w-4" />
              )}
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
