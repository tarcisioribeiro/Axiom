import { useState, useEffect } from 'react';
import { Plus, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { PageContainer } from '@/components/common/PageContainer';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/utils/error-utils';
import type { DailyReflection } from '@/types';

export default function DailyReflections() {
  const [reflections, setReflections] = useState<DailyReflection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      // TODO: Implementar chamada ao service
      setReflections([]);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar reflexões',
        description: getErrorMessage(error),
        variant: 'destructive'
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
      <PageHeader
        title="Reflexões Diárias"
      >
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
            <div key={reflection.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold">{reflection.date}</span>
                {reflection.mood && (
                  <span className="text-sm capitalize">
                    {reflection.mood}
                  </span>
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
