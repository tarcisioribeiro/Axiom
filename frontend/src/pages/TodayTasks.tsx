import { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { PageContainer } from '@/components/common/PageContainer';
import { taskInstancesService } from '@/services/task-instances-service';
import { appService } from '@/services/app-service';
import { useToast } from '@/hooks/use-toast';
import type { TaskInstance } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';
import { formatLocalDate } from '@/lib/utils';

export default function TodayTasks() {
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      // Get current date from server
      let today: string;
      try {
        today = await appService.getCurrentDate();
      } catch {
        today = formatLocalDate(new Date());
      }
      // Get instances for today
      const response = await taskInstancesService.getForDate(today);
      setTasks(response.instances);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar tarefas',
        description: getErrorMessage(error),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success';
      case 'in_progress':
        return 'bg-warning';
      case 'skipped':
        return 'bg-muted';
      default:
        return 'bg-secondary';
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Tarefas de Hoje"
        icon={<CheckCircle2 />}
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-12 w-12 text-muted-foreground" />}
          message="Nenhuma tarefa programada para hoje."
        />
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="border rounded-lg p-4 flex items-center gap-4">
              <CheckCircle2
                className={`h-6 w-6 ${
                  task.status === 'completed' ? 'text-success' : 'text-muted'
                }`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{task.task_name}</h3>
                  <Badge className={getStatusColor(task.status)}>
                    {task.status_display}
                  </Badge>
                </div>
                {task.time_display && (
                  <p className="text-sm">
                    Horário: {task.time_display}
                  </p>
                )}
                {task.notes && (
                  <p className="text-sm">{task.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
