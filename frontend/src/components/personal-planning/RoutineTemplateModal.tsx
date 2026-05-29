import { Download, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getIconByName } from '@/components/ui/icon-picker';
import { useToast } from '@/hooks/use-toast';
import { routineTemplatesService } from '@/services/routine-templates-service';
import type { RoutineTemplate } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface RoutineTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (createdIds: number[]) => void;
}

const PERIODICITY_LABELS: Record<string, string> = {
  daily: 'Diário',
  weekdays: 'Dias úteis',
  weekly: 'Semanal',
  monthly: 'Mensal',
  custom: 'Personalizado',
};

const CATEGORY_COLORS: Record<string, string> = {
  health: 'bg-category-health',
  studies: 'bg-category-studies',
  spiritual: 'bg-category-spiritual',
  exercise: 'bg-category-exercise',
  nutrition: 'bg-category-nutrition',
  meditation: 'bg-category-spiritual',
  reading: 'bg-category-studies',
  writing: 'bg-category-work',
  work: 'bg-category-work',
  leisure: 'bg-category-leisure',
  family: 'bg-accent',
  social: 'bg-category-leisure',
  finance: 'bg-category-finance',
  household: 'bg-category-nutrition',
  personal_care: 'bg-category-health',
  other: 'bg-muted',
};

export function RoutineTemplateModal({
  open,
  onOpenChange,
  onImported,
}: RoutineTemplateModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      void loadTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const data = await routineTemplatesService.getAll();
      setTemplates(data);
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.templates.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (template: RoutineTemplate) => {
    setImportingId(template.id);
    try {
      const result = await routineTemplatesService.importTemplate(template.id);

      if (result.created_ids.length === 0) {
        toast({
          title: t('pages.routineTasks.templates.alreadyImported'),
          description: t('pages.routineTasks.templates.alreadyImportedDesc', {
            name: template.name,
          }),
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: t('pages.routineTasks.templates.importSuccess'),
        description: t('pages.routineTasks.templates.importSuccessDesc', {
          count: result.created_ids.length,
          name: result.template_name,
        }),
      });

      onOpenChange(false);
      onImported(result.created_ids);
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.templates.importError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setImportingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="custom-scrollbar max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('pages.routineTasks.templates.title')}</DialogTitle>
          <DialogDescription>
            {t('pages.routineTasks.templates.description')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-md">
            {templates.map((template) => {
              const TemplateIcon = getIconByName(template.icon);
              const isExpanded = expandedId === template.id;
              const isImporting = importingId === template.id;

              return (
                <div key={template.id} className="rounded-lg border bg-card p-md">
                  {/* Template header */}
                  <div className="flex items-start justify-between gap-sm">
                    <div className="flex items-center gap-sm">
                      {TemplateIcon && (
                        <TemplateIcon className="h-5 w-5 shrink-0 text-primary" />
                      )}
                      <div>
                        <p className="font-semibold">{template.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {template.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-sm">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(isExpanded ? null : template.id)}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded
                          ? t('pages.routineTasks.templates.hideTasks')
                          : t('pages.routineTasks.templates.showTasks', {
                              count: template.task_count,
                            })}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void handleImport(template)}
                        disabled={isImporting}
                      >
                        {isImporting ? (
                          <Loader2 className="mr-sm h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-sm h-4 w-4" />
                        )}
                        {t('pages.routineTasks.templates.importBtn')}
                      </Button>
                    </div>
                  </div>

                  {/* Task preview */}
                  {isExpanded && (
                    <div className="mt-md flex flex-col gap-sm border-t pt-md">
                      {template.tasks.map((task, index) => {
                        const TaskIcon = getIconByName(task.icon ?? '');
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-sm rounded-md bg-muted/40 px-sm py-xs"
                          >
                            {TaskIcon ? (
                              <TaskIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <span className="h-4 w-4 shrink-0" />
                            )}
                            <span className="flex-1 text-sm font-medium">
                              {task.name}
                            </span>
                            <Badge
                              className={`text-xs ${CATEGORY_COLORS[task.category] ?? 'bg-muted'}`}
                            >
                              {PERIODICITY_LABELS[task.periodicity] ?? task.periodicity}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {task.target_quantity} {task.unit}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
