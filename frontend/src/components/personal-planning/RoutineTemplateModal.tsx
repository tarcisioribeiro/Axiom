/* eslint-disable max-lines */
import { Download, Loader2, Trash2, User } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { routineTemplatesService } from '@/services/routine-templates-service';
import { userRoutineTemplatesService } from '@/services/user-routine-templates-service';
import type { RoutineTemplate, UserRoutineTemplate } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface RoutineTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (createdIds: number[]) => void;
}

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

function SystemTemplateList({
  templates,
  isLoading,
  onImport,
  importingId,
}: {
  templates: RoutineTemplate[];
  isLoading: boolean;
  onImport: (template: RoutineTemplate) => void;
  importingId: string | null;
}) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      {templates.map((template) => {
        const TemplateIcon = getIconByName(template.icon);
        const isExpanded = expandedId === template.id;
        const isImporting = importingId === template.id;

        return (
          <div key={template.id} className="rounded-lg border bg-card p-md">
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
                  onClick={() => onImport(template)}
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
                      <span className="flex-1 text-sm font-medium">{task.name}</span>
                      <Badge
                        className={`text-xs ${CATEGORY_COLORS[task.category] ?? 'bg-muted'}`}
                      >
                        {t(
                          `pages.routineTasks.form.periodicityOptions.${task.periodicity}`,
                          { defaultValue: task.periodicity }
                        )}
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
  );
}

function UserTemplateList({
  templates,
  isLoading,
  onImport,
  onDelete,
  importingId,
}: {
  templates: UserRoutineTemplate[];
  isLoading: boolean;
  onImport: (template: UserRoutineTemplate) => void;
  onDelete: (id: number) => void;
  importingId: number | null;
}) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-sm py-12 text-center">
        <User className="h-10 w-10 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">
          {t('pages.routineTasks.templates.noUserTemplates')}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('pages.routineTasks.templates.noUserTemplatesHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      {templates.map((template) => {
        const TemplateIcon = getIconByName(template.icon);
        const isExpanded = expandedId === template.id;
        const isImporting = importingId === template.id;

        return (
          <div key={template.id} className="rounded-lg border bg-card p-md">
            <div className="flex items-start justify-between gap-sm">
              <div className="flex items-center gap-sm">
                {TemplateIcon && (
                  <TemplateIcon className="h-5 w-5 shrink-0 text-primary" />
                )}
                <div>
                  <p className="font-semibold">{template.name}</p>
                  {template.description && (
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {template.task_count} {t('pages.routineTasks.templates.taskCount')}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-sm">
                {template.tasks.length > 0 && (
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
                )}
                <Button
                  size="sm"
                  onClick={() => onImport(template)}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="mr-sm h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-sm h-4 w-4" />
                  )}
                  {t('pages.routineTasks.templates.importBtn')}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => onDelete(template.id)}
                  title={t('common.actions.delete')}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            {isExpanded && template.tasks.length > 0 && (
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
                      <span className="flex-1 text-sm font-medium">{task.name}</span>
                      <Badge
                        className={`text-xs ${CATEGORY_COLORS[task.category] ?? 'bg-muted'}`}
                      >
                        {t(
                          `pages.routineTasks.form.periodicityOptions.${task.periodicity}`,
                          { defaultValue: task.periodicity }
                        )}
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
  );
}

export function RoutineTemplateModal({
  open,
  onOpenChange,
  onImported,
}: RoutineTemplateModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const [activeTab, setActiveTab] = useState('system');

  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [isLoadingSystem, setIsLoadingSystem] = useState(false);
  const [importingSystemId, setImportingSystemId] = useState<string | null>(null);

  const [userTemplates, setUserTemplates] = useState<UserRoutineTemplate[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [importingUserId, setImportingUserId] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      void loadSystemTemplates();
      void loadUserTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadSystemTemplates = async () => {
    try {
      setIsLoadingSystem(true);
      const data = await routineTemplatesService.getAll();
      setTemplates(data);
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.templates.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoadingSystem(false);
    }
  };

  const loadUserTemplates = async () => {
    try {
      setIsLoadingUser(true);
      const data = await userRoutineTemplatesService.getAll();
      setUserTemplates(data);
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.templates.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleImportSystem = async (template: RoutineTemplate) => {
    setImportingSystemId(template.id);
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
      setImportingSystemId(null);
    }
  };

  const handleImportUser = async (template: UserRoutineTemplate) => {
    setImportingUserId(template.id);
    try {
      const result = await userRoutineTemplatesService.importTemplate(template.id);
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
      setImportingUserId(null);
    }
  };

  const handleDeleteUserTemplate = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.routineTasks.templates.deleteTitle'),
      description: t('pages.routineTasks.templates.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await userRoutineTemplatesService.delete(id);
      setUserTemplates((prev) => prev.filter((t) => t.id !== id));
      toast({ title: t('pages.routineTasks.templates.deleted') });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="system" className="flex-1">
              {t('pages.routineTasks.templates.systemTab')}
            </TabsTrigger>
            <TabsTrigger value="user" className="flex-1">
              {t('pages.routineTasks.templates.myTab')}
              {userTemplates.length > 0 && (
                <span className="ml-xs rounded-full bg-primary/15 px-xs text-xs text-primary">
                  {userTemplates.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="system" className="mt-md">
            <SystemTemplateList
              templates={templates}
              isLoading={isLoadingSystem}
              onImport={(t) => void handleImportSystem(t)}
              importingId={importingSystemId}
            />
          </TabsContent>
          <TabsContent value="user" className="mt-md">
            <UserTemplateList
              templates={userTemplates}
              isLoading={isLoadingUser}
              onImport={(t) => void handleImportUser(t)}
              onDelete={(id) => void handleDeleteUserTemplate(id)}
              importingId={importingUserId}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
