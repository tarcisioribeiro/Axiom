import { Plus, StickyNote } from 'lucide-react';
import { useState, useEffect } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { DailyReflection } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function DailyReflections() {
  const [reflections, setReflections] = useState<DailyReflection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = () => {
    try {
      setIsLoading(true);
      // TODO: Implementar chamada ao service
      setReflections([]);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar reflexões',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader title="Reflexões Diárias">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Reflexão
        </Button>
      </PageHeader>

      {reflections.length === 0 ? (
        <EmptyState
          icon={<StickyNote className="h-12 w-12 text-muted-foreground" />}
          message="Nenhuma reflexão registrada."
        />
      ) : (
        <div className="space-y-4">
          {reflections.map((reflection) => (
            <div key={reflection.id} className="rounded-lg border p-4">
              <div className="mb-2 flex items-start justify-between">
                <span className="font-semibold">{reflection.date}</span>
                {reflection.mood && (
                  <span className="text-sm capitalize">{reflection.mood}</span>
                )}
              </div>
              <p>{reflection.reflection}</p>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
